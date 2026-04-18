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
        `Phone: ${shop.tel}`,
        `Hours: ${shop.openTime} – ${shop.closeTime}`,
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
          `Shop location: ${shop.location}`,
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
  const hits = retrieve(queryEmbedding, 6);
  const context = hits.map((h) => h.text).join('\n\n---\n\n');

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
        .map((r, i) => `  ${i + 1}. ${r.shop} — ${r.service} (${r.duration} min, ฿${r.price}) on ${r.date} [${r.status}]`)
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
- Users can cancel reservations up to 1 day before the reservation date
- If the user has 3 active reservations, tell them they must cancel one before booking again
- Always use relative paths for internal links (e.g. /booking?shop=ID&service=ID, /shop/ID, /mybookings) — NEVER prefix them with any domain name
- If TikTok links are available and the user asks for them, list them clearly
- If you don't know something, say so honestly — don't make up shop names or prices
- Keep answers concise and friendly. Respond in the same language the user uses (Thai or English)
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
    max_tokens: 600,
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
