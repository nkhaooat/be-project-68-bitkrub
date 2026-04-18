/**
 * Embedding-based RAG chatbot for Dungeon Inn massage shop website.
 *
 * Flow:
 *  1. buildVectorStore() — called once at startup. Fetches all shops + services
 *     from MongoDB, generates embeddings, and stores them in memory.
 *  2. chat(userMessage) — embeds the user message, finds top-K similar chunks
 *     via cosine similarity, injects them as context into a GPT completion.
 *
 * TikTok links and shop descriptions are stored in MongoDB (MassageShop model).
 * No static map needed — all data comes from the DB.
 */

const OpenAI = require('openai');
const MassageShop = require('../models/MassageShop');
const MassageService = require('../models/MassageService');

// ---------------------------------------------------------------------------
// Vector store (in-memory)
// ---------------------------------------------------------------------------
let vectorStore = []; // [{ text, embedding: number[], metadata }]
let storeReady = false;
let buildPromise = null;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cosine similarity between two equal-length float arrays */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

/** Embed a single string (or batch of strings) */
async function embed(input) {
  const isArray = Array.isArray(input);
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: isArray ? input : [input],
  });
  const vecs = response.data.map((d) => d.embedding);
  return isArray ? vecs : vecs[0];
}

/** Split a long text into overlapping chunks */
function chunkText(text, maxWords = 120, overlapWords = 20) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords - overlapWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
    if (i + maxWords >= words.length) break;
  }
  return chunks.length ? chunks : [text];
}

// ---------------------------------------------------------------------------
// Build vector store
// ---------------------------------------------------------------------------

async function buildVectorStore() {
  if (storeReady) return;
  if (buildPromise) return buildPromise;

  buildPromise = (async () => {
    console.log('[chatbot] Building vector store...');
    const docs = []; // { text, metadata }

    // 1. Fetch shops with their services
    const shops = await MassageShop.find({}).lean();
    const services = await MassageService.find({}).lean();

    // Group services by shop
    const servicesByShop = {};
    for (const svc of services) {
      const shopId = svc.shop.toString();
      if (!servicesByShop[shopId]) servicesByShop[shopId] = [];
      servicesByShop[shopId].push(svc);
    }

    for (const shop of shops) {
      const shopId = shop._id.toString();
      const shopServices = servicesByShop[shopId] || [];
      const tiktokLinks = (shop.tiktokLinks && shop.tiktokLinks.length) ? shop.tiktokLinks : [];
      const hasTiktok = tiktokLinks.length > 0;

      // Auto-generate description if none stored
      const description = shop.description ||
        `${shop.name} is a massage shop in ${shop.location}, Bangkok. ` +
        `Price range: ฿${shop.priceRangeMin}–฿${shop.priceRangeMax}. ` +
        `Open ${shop.openTime}–${shop.closeTime}.` +
        (shop.rating ? ` Rated ${shop.rating}/5.` : '') +
        (hasTiktok ? ' Has TikTok content available.' : '');

      // --- Shop summary chunk ---
      const shopText = [
        `Shop: ${shop.name}`,
        `Location: ${shop.location}${shop.searchArea ? " (" + shop.searchArea + ")" : ""}`,
        `Address: ${shop.address}`,
        shop.tel ? `Phone: ${shop.tel}` : '',
        `Hours: ${shop.openTime} – ${shop.closeTime}`,
        shop.hours && shop.hours.length ? `Weekly hours: ${shop.hours.join(" | ")}` : '',
        `Price range: ฿${shop.priceRangeMin} – ฿${shop.priceRangeMax}`,
        shop.rating ? `Rating: ${shop.rating}/5` : '',
        shop.map ? `Map: ${shop.map}` : '',
        `Description: ${description}`,
        hasTiktok
          ? `TikTok videos: ${tiktokLinks.join(', ')}`
          : 'No TikTok videos available for this shop.',
        `Booking page: /shop/${shopId}`,
      ]
        .filter(Boolean)
        .join('\n');

      docs.push({
        text: shopText,
        metadata: { type: 'shop', shopId, shopName: shop.name, tiktokLinks },
      });

      // --- Per-service chunks ---
      for (const svc of shopServices) {
        const svcText = [
          `Service: ${svc.name} at ${shop.name}`,
          `Area: ${svc.area}`,
          `Duration: ${svc.duration} minutes`,
          `Oil: ${svc.oil}`,
          `Price: ฿${svc.price}`,
          svc.sessions > 1 ? `Sessions: ${svc.sessions}` : '',
          svc.description ? `Description: ${svc.description}` : '',
          `Shop location: ${shop.location}${shop.searchArea ? " (" + shop.searchArea + ")" : ""}`,
          `Book this service: /booking?shop=${shopId}&service=${svc._id}`,
        ]
          .filter(Boolean)
          .join('\n');

        docs.push({
          text: svcText,
          metadata: {
            type: 'service',
            shopId,
            shopName: shop.name,
            serviceId: svc._id.toString(),
            serviceName: svc.name,
          },
        });
      }

      // --- TikTok-focused chunk (if shop has links) ---
      if (tiktokLinks.length) {
        const ttText = [
          `TikTok content for ${shop.name}:`,
          ...tiktokLinks.map((url, i) => `  Video ${i + 1}: ${url}`),
          `Shop location: ${shop.location}`,
          `Address: ${shop.address}`,
        ].join('\n');

        docs.push({
          text: ttText,
          metadata: { type: 'tiktok', shopId, shopName: shop.name, tiktokLinks },
        });
      }
    }

    // 2. Embed in batches of 20
    const BATCH = 20;
    for (let i = 0; i < docs.length; i += BATCH) {
      const batch = docs.slice(i, i + BATCH);
      const texts = batch.map((d) => d.text);
      const embeddings = await embed(texts);
      for (let j = 0; j < batch.length; j++) {
        vectorStore.push({ ...batch[j], embedding: embeddings[j] });
      }
    }

    storeReady = true;
    console.log(`[chatbot] Vector store ready — ${vectorStore.length} chunks indexed.`);
  })();

  return buildPromise;
}

// ---------------------------------------------------------------------------
// Retrieve top-K similar chunks
// ---------------------------------------------------------------------------

function retrieve(queryEmbedding, topK = 6) {
  return vectorStore
    .map((item) => ({
      ...item,
      score: cosineSimilarity(queryEmbedding, item.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}


// ---------------------------------------------------------------------------
// Main chat function
// ---------------------------------------------------------------------------

/**
 * @param {string} userMessage
 * @param {{ role: string, content: string }[]} history  - prior turns (optional)
 * @param {{ activeCount: number, slotsRemaining: number, reservations: object[] } | null} userContext
 * @param {{ temp: number, wind: number, rainChance: number } | null} weather - from client (GISTDA, Thai IP only)
 * @returns {Promise<string>} assistant reply
 */
async function chat(userMessage, history = [], userContext = null, weather = null) {
  // Ensure the vector store is built
  if (!storeReady) await buildVectorStore();

  // Embed the user query
  const queryEmbedding = await embed(userMessage);

  // Retrieve relevant chunks
  const hits = retrieve(queryEmbedding, 12);
  const context = hits.map((h) => h.text).join('\n\n---\n\n');

  // --- Shop-pinning: if a known shop is mentioned in recent history or message,
  //     inject its full service list so the LLM always has the right IDs ---
  let shopPinBlock = '';
  try {
    // Collect all shop names from vector store metadata
    const allShopNames = [...new Set(hits.map(h => h.metadata?.shopName).filter(Boolean))];
    // Also scan last 3 history messages for shop names
    const recentText = (history.slice(-3).map(m => m.content).join(' ') + ' ' + userMessage).toLowerCase();
    const MassageShop = require('./models/MassageShop');
    const MassageService = require('./models/MassageService');
    // Find any shop whose name appears in the recent conversation
    const allShops = await MassageShop.find({}, '_id name searchArea openTime closeTime priceRangeMin priceRangeMax rating map').lean();
    const mentionedShop = allShops.find(s => recentText.includes(s.name.toLowerCase().slice(0, 20)));
    if (mentionedShop) {
      const svcs = await MassageService.find({ shop: mentionedShop._id }, '_id name duration price description').lean();
      const svcLines = svcs.map(s =>
        `  - [serviceId:${s._id}] ${s.name} | ${s.duration} min | ฿${s.price}${s.description ? ' | ' + s.description : ''}`
      ).join('\n');
      shopPinBlock = `
--- PINNED SHOP (user is asking about this specific shop) ---
Shop: ${mentionedShop.name}
shopId: ${mentionedShop._id}
Area: ${mentionedShop.searchArea || 'Bangkok'}
Hours: ${mentionedShop.openTime} – ${mentionedShop.closeTime}
Price range: ฿${mentionedShop.priceRangeMin} – ฿${mentionedShop.priceRangeMax}
Rating: ${mentionedShop.rating}/5
Map: ${mentionedShop.map || ''}
Booking page: /shop/${mentionedShop._id}
Services (use ONLY these IDs for this shop):
${svcLines}
--- END PINNED SHOP ---`;
    }
  } catch (e) {
    // non-fatal
  }

  // Build user reservation context block
  let reservationBlock = '';
  if (userContext) {
    if (userContext.activeCount === 0) {
      reservationBlock = `
--- USER RESERVATION STATUS ---
The user is logged in and has 0 active reservations.
They can book up to 3 services (3 slots remaining).
--- END ---`;
    } else {
      const resvList = userContext.reservations
        .map((r, i) => `  ${i + 1}. [ID:${r.id}] ${r.shop} — ${r.service} (${r.duration} min, ฿${r.price}) on ${r.date} [${r.status}]`)
        .join('\n');
      reservationBlock = `
--- USER RESERVATION STATUS ---
The user is logged in and has ${userContext.activeCount} active reservation(s) out of a maximum of 3.
Slots remaining: ${userContext.slotsRemaining}
Active bookings:
${resvList}
${userContext.slotsRemaining === 0 ? 'IMPORTANT: The user cannot make any new bookings until they cancel an existing one.' : ''}
--- END ---`;
    }
  } else {
    reservationBlock = `
--- USER STATUS ---
The user is not logged in (guest). You do not know their reservation status.
Remind them to log in if they ask about their bookings or want to make a reservation.
--- END ---`;
  }

  // Build weather context
  const weatherBlock = weather
    ? `Current Bangkok weather: ${weather.temp.toFixed(1)}°C, wind ${weather.wind.toFixed(1)} km/h, rain chance ${weather.rainChance}%.`
    : '';

  // Build messages
  const now = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const systemPrompt = `You are a helpful assistant for "Dungeon Inn", a massage shop booking website in Bangkok, Thailand.
Current date and time (Bangkok, GMT+7): ${now}
${weatherBlock}
Website: https://fe-project-68-addressme.vercel.app


You help users:
- Find massage shops (by location, price, type, rating, hours)
- Learn about services (type, duration, oil, price)
- Get TikTok video links for shops
- Navigate to booking pages
- Know if a shop is currently open based on the current time above
- Check their own reservation status and remaining booking slots

Rules:
- Users can have at most 3 active (pending/confirmed) reservations at a time
- Users can cancel any pending or confirmed reservation — the backend enforces all business rules, do not add extra restrictions
- IMPORTANT: Never try to calculate date differences yourself. Always attempt the cancellation and let the API decide — if the cancellation is too close to the date, the backend will return an error which will be shown to the user automatically.
- If the user has 3 active reservations, tell them they must cancel one before booking again
- Always use relative paths for internal links (e.g. /booking?shop=ID&service=ID, /shop/ID, /mybookings) — NEVER prefix them with any domain name
- If TikTok links are available and the user asks for them, list them clearly
- If you don't know something, say so honestly — don't make up shop names or prices
- Keep answers concise and friendly. Respond in the same language the user uses (Thai or English)

BOOKING ACTION:
When the user confirms they want to book a specific service at a specific shop at a specific time,
respond with ONLY this exact JSON on its own line (nothing else on that line):
[[BOOK:{"shopId":"SHOP_ID","serviceId":"SERVICE_ID","resvDate":"ISO_DATETIME"}]]
Then on the next line, add a friendly confirmation message saying the booking is being processed.
Use the shopId and serviceId from the retrieved context above.
For the resvDate, use today's date with the requested time in ISO 8601 format with Bangkok timezone offset (+07:00).
Only emit [[BOOK:...]] when the user has explicitly confirmed (said yes/ใช่/ยืนยัน/confirm/ok/โอเค etc.) AND you have both shopId and serviceId available.
Never make up IDs — only use IDs from the retrieved context.

CANCEL ACTION:
When the user confirms they want to cancel a specific reservation,
respond with ONLY this exact JSON on its own line:
[[CANCEL:{"reservationId":"RESERVATION_ID"}]]
Then on the next line, add a friendly message saying the cancellation is being processed.
Use the reservation ID from the USER RESERVATION STATUS block (shown as [ID:...] in the booking list).
Only emit [[CANCEL:...]] when the user has explicitly confirmed cancellation AND you have the reservation ID.
Confirm the cancellation and proceed — the backend will enforce any business rules.
CRITICAL - SHOP ID ACCURACY:
When the user is discussing a specific shop (by name), you MUST only use shopId and serviceId values
from chunks that explicitly contain that exact shop name.
NEVER use IDs from a different shop even if the service name matches.
If the retrieved context does not contain the correct shop's data, say you need more info — do NOT guess IDs.
If you are about to emit [[BOOK:...]], double-check: does the shopId in your context match the shop the user named?
${shopPinBlock}
${reservationBlock}
--- RETRIEVED CONTEXT ---
${context}
--- END CONTEXT ---`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6), // keep last 3 turns for context
    { role: 'user', content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 1200,
    temperature: 0.4,
  });

  return completion.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Reset the vector store so it rebuilds on next call */
function resetVectorStore() {
  vectorStore = [];
  storeReady = false;
  buildPromise = null;
}

module.exports = { buildVectorStore, chat, resetVectorStore };
