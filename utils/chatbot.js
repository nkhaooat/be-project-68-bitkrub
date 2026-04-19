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

// ---------------------------------------------------------------------------
// Thai translation helper (batch per shop for efficiency)
// ---------------------------------------------------------------------------

/**
 * Ensure Thai translations exist for a shop + its services.
 * - If all Thai fields are already in DB → use them (no GPT call).
 * - If any are missing → call GPT once for the whole shop, then persist to DB.
 * Returns { shopNameTh, locationTh, descriptionTh, services: [{ nameTh, areaTh, descTh }] } or null.
 */
async function ensureThaiTranslation(shop, shopServices) {
  // Check if shop already has Thai cached
  const shopHasThai = shop.nameTh && shop.locationTh && shop.searchAreaTh;
  const servicesHaveThai = shopServices.every(s => s.nameTh && s.areaTh);

  if (shopHasThai && servicesHaveThai) {
    // All cached — return from DB directly
    return {
      shopNameTh: shop.nameTh,
      locationTh: shop.locationTh,
      descriptionTh: shop.descriptionTh,
      searchAreaTh: shop.searchAreaTh,
      services: shopServices.map(s => ({
        nameTh: s.nameTh,
        areaTh: s.areaTh,
        descTh: s.descriptionTh,
      })),
    };
  }

  // Need to translate — call GPT once for the whole shop
  try {
    const serviceItems = shopServices.map((s, i) =>
      `service${i}: name="${s.name}", area="${s.area}"${s.description ? `, description="${s.description}"` : ''}`
    ).join('\n');

    const prompt = `Translate the following massage shop info to Thai. Reply ONLY with valid JSON, no explanation.

Shop name: "${shop.name}"
Address (translate to Thai): "${shop.address}"
Search area: "${shop.searchArea || ''}"
Description: "${shop.description || ''}"
Services:
${serviceItems}

Reply format:
{
  "shopNameTh": "...",
  "locationTh": "...",
  "searchAreaTh": "...",
  "descriptionTh": "...",
  "services": [
    { "nameTh": "...", "areaTh": "...", "descTh": "..." }
  ]
}

For locationTh: translate the address to Thai (street name, district, subdistrict).
For searchAreaTh: translate the neighborhood name with common Thai aliases separated by commas (e.g. Khao San → ข้าวสาร, ถนนข้าวสาร; Sukhumvit → สุขุมวิท, ถนนสุขุมวิท; Silom → สีลม, ถนนสีลม, พัฒน์พงศ์).`;

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const thai = JSON.parse(resp.choices[0].message.content);

    // Persist to MongoDB so next rebuild skips GPT
    await MassageShop.updateOne(
      { _id: shop._id },
      { $set: { nameTh: thai.shopNameTh, locationTh: thai.locationTh, descriptionTh: thai.descriptionTh, searchAreaTh: thai.searchAreaTh } }
    );
    for (let i = 0; i < shopServices.length; i++) {
      const svcThai = thai.services?.[i];
      if (svcThai) {
        await MassageService.updateOne(
          { _id: shopServices[i]._id },
          { $set: { nameTh: svcThai.nameTh, areaTh: svcThai.areaTh, descriptionTh: svcThai.descTh } }
        );
      }
    }

    console.log(`[chatbot] Translated & cached Thai for: ${shop.name}`);
    return thai;
  } catch (e) {
    console.warn(`[chatbot] Thai translation failed for ${shop.name}:`, e.message);
    return null;
  }
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

      // --- Get Thai translations (from DB cache or GPT if missing) ---
      const thai = await ensureThaiTranslation(shop, shopServices);

      // --- Shop summary chunk (English + Thai) ---
      const shopText = [
        `Shop: ${shop.name}`,
        thai ? `ร้าน: ${thai.shopNameTh}` : '',
        `Location: ${shop.location}${shop.searchArea ? " (" + shop.searchArea + ")" : ""}`,
        thai && thai.locationTh ? `ที่อยู่: ${thai.locationTh}` : '',
        shop.searchArea ? `Area: ${shop.searchArea}` : '',
        thai && thai.searchAreaTh ? `ย่าน: ${thai.searchAreaTh}` : '',
        `Address: ${shop.address}`,
        shop.tel ? `Phone: ${shop.tel}` : '',
        `Hours: ${shop.openTime} – ${shop.closeTime}`,
        `เวลาทำการ: ${shop.openTime} – ${shop.closeTime}`,
        shop.hours && shop.hours.length ? `Weekly hours: ${shop.hours.join(" | ")}` : '',
        `Price range: ฿${shop.priceRangeMin} – ฿${shop.priceRangeMax}`,
        `ช่วงราคา: ฿${shop.priceRangeMin} – ฿${shop.priceRangeMax}`,
        shop.rating ? `Rating: ${shop.rating}/5` : '',
        shop.rating ? `คะแนน: ${shop.rating}/5` : '',
        shop.map ? `Map: ${shop.map}` : '',
        `Description: ${description}`,
        thai && thai.descriptionTh ? `รายละเอียด: ${thai.descriptionTh}` : '',
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

      // --- Per-service chunks (English + Thai) ---
      for (let si = 0; si < shopServices.length; si++) {
        const svc = shopServices[si];
        const svcThai = thai && thai.services && thai.services[si];
        const svcText = [
          `Service: ${svc.name} at ${shop.name}`,
          svcThai ? `บริการ: ${svcThai.nameTh} ที่ ${thai.shopNameTh}` : '',
          `Area: ${svc.area}`,
          svcThai ? `ประเภท: ${svcThai.areaTh}` : '',
          `Duration: ${svc.duration} minutes`,
          `ระยะเวลา: ${svc.duration} นาที`,
          `Oil: ${svc.oil}`,
          `Price: ฿${svc.price}`,
          `ราคา: ฿${svc.price}`,
          svc.sessions > 1 ? `Sessions: ${svc.sessions}` : '',
          svc.description ? `Description: ${svc.description}` : '',
          svcThai && svcThai.descTh ? `รายละเอียด: ${svcThai.descTh}` : '',
          `Shop location: ${shop.location}${shop.searchArea ? " (" + shop.searchArea + ")" : ""}`,
          thai && thai.locationTh ? `ที่อยู่ร้าน: ${thai.locationTh}` : '',
          thai && thai.searchAreaTh ? `ย่าน: ${thai.searchAreaTh}` : '',
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
          thai ? `คลิป TikTok ของ ${thai.shopNameTh}:` : '',
          ...tiktokLinks.map((url, i) => `  Video ${i + 1}: ${url}`),
          `Shop location: ${shop.location}`,
          `Address: ${shop.address}`,
        ].filter(Boolean).join('\n');

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

  // Retrieve relevant chunks — filter out service chunks from other shops when a shop is pinned
  const allHits = retrieve(queryEmbedding, 12);
  // We'll apply shop filter after pinning is resolved below

  // --- Shop-pinning: find the shop the user is currently talking about ---
  //     Strategy 1: extract shopId from /shop/:id URL nearest to a shop name in current message
  //     Strategy 2: if no URL match, fall back to longest name match in DB
  let shopPinBlock = '';
  let mentionedShop = null;
  try {
    const MassageShop = require('./models/MassageShop');
    const MassageService = require('./models/MassageService');
    const recentMessages = history.slice(-8).map(m => m.content);
    const recentText = recentMessages.join('\n') + '\n' + userMessage;

    // Build a map of shopId -> shop name from all /shop/<id> links in history
    const shopIdPattern = /\/shop\/([a-f0-9]{24})/gi;
    const allShopIds = [...recentText.matchAll(shopIdPattern)].map(m => m[1]);
    const uniqueShopIds = [...new Set(allShopIds)];

    if (uniqueShopIds.length === 1) {
      // Only one shop mentioned — easy
      mentionedShop = await MassageShop.findById(uniqueShopIds[0], '_id name searchArea openTime closeTime priceRangeMin priceRangeMax rating map').lean();
    } else if (uniqueShopIds.length > 1) {
      // Multiple shops — find which one the user is referring to in their current message
      // Load all candidate shops, then pick the one whose name appears in the current user message
      const candidates = await MassageShop.find(
        { _id: { $in: uniqueShopIds } },
        '_id name searchArea openTime closeTime priceRangeMin priceRangeMax rating map'
      ).lean();
      const userMsgLC = userMessage.toLowerCase();
      // Score each candidate by how much of its name appears in the user message
      mentionedShop = candidates
        .map(s => {
          const words = s.name.toLowerCase().split(/\s+/);
          const score = words.filter(w => w.length > 3 && userMsgLC.includes(w)).length;
          return { shop: s, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.shop
        // If no keyword overlap, fall back to the last /shop/ URL in history (most recently discussed)
        || candidates.find(s => s._id.toString() === allShopIds[allShopIds.length - 1]);
    } else {
      // No URLs in history — user specified shop by name before any links existed
      // Fall back to longest name match
      const allShops = await MassageShop.find({}, '_id name searchArea openTime closeTime priceRangeMin priceRangeMax rating map').lean();
      const userMsgLC = userMessage.toLowerCase();
      mentionedShop = allShops
        .filter(s => {
          const nameLC = s.name.toLowerCase();
          const matchLen = Math.min(nameLC.length, 40);
          return userMsgLC.includes(nameLC.slice(0, matchLen))
            || recentText.toLowerCase().includes(nameLC.slice(0, matchLen));
        })
        .sort((a, b) => b.name.length - a.name.length)[0];
    }
    if (mentionedShop) {
      const svcs = await MassageService.find({ shop: mentionedShop._id }, '_id name duration price description').lean();
      const svcLines = svcs.map(s =>
        `  - [serviceId:${s._id}] ${s.name} | ${s.duration} min | ฿${s.price}${s.description ? ' | ' + s.description : ''}`
      ).join('\n');

      // Also extract serviceId from ?service=<id> URLs if present in recent conversation
      const serviceIdMatch = recentText.match(/[?&]service=([a-f0-9]{24})/i);
      const pinnedServiceNote = serviceIdMatch
        ? `\n\nIMPORTANT: The user is specifically asking about serviceId ${serviceIdMatch[1]} — use ONLY this service ID for booking.`
        : '';

      shopPinBlock = `
--- PINNED SHOP (user is asking about this specific shop) ---
⚠️ CRITICAL: When booking this shop, you MUST use ONLY the serviceIds listed below.
DO NOT use any serviceId from the vector retrieval context — those may be from other shops.
Shop: ${mentionedShop.name}
shopId: ${mentionedShop._id}
Area: ${mentionedShop.searchArea || 'Bangkok'}
Hours: ${mentionedShop.openTime} – ${mentionedShop.closeTime}
Price range: ฿${mentionedShop.priceRangeMin} – ฿${mentionedShop.priceRangeMax}
Rating: ${mentionedShop.rating}/5
Map: ${mentionedShop.map || ''}
Booking page: /shop/${mentionedShop._id}
Services (use ONLY these IDs for this shop):
${svcLines}${pinnedServiceNote}
--- END PINNED SHOP ---`;
    }
  } catch (e) {
    // non-fatal
  }

  // Filter retrieved chunks: when a shop is pinned, drop service chunks from OTHER shops
  // to prevent the LLM from accidentally picking wrong serviceIds
  const hits = mentionedShop
    ? allHits.filter(h =>
        h.metadata?.type !== 'service' || h.metadata?.shopId === mentionedShop._id.toString()
      )
    : allHits;
  const context = hits.map((h) => h.text).join('\n\n---\n\n');
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
        .map((r, i) => `  ${i + 1}. [ID:${r.id}] ${r.shop} — ${r.service} (${r.duration} min, ฿${r.price}) on ${r.date} [${r.status}] [${r.hoursUntil}h until reservation] [canEdit/cancel: ${r.canModify}]`)
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
  const nowDate = new Date();
  const now = nowDate.toLocaleString('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const nowISO = nowDate.toISOString(); // for precise date math

  const systemPrompt = `You are a helpful assistant for "Dungeon Inn", a massage shop booking website in Bangkok, Thailand.
Current date and time (Bangkok, GMT+7): ${now}
Current UTC timestamp (for precise date math): ${nowISO}
${weatherBlock}
Website: https://fe-project-68-addressme.vercel.app

You help users:
- Find massage shops (by location, price, type, rating, hours)
- Learn about services (type, duration, oil, price)
- Get TikTok video links for shops
- Navigate to booking pages
- Know if a shop is currently open based on the current time above
- Check their own reservation status and remaining booking slots

Language: Respond in the same language the user uses (Thai or English).
The knowledge base contains both English and Thai text — use whichever matches the user's query.

Rules:
- Users can have at most 3 active (pending/confirmed) reservations at a time
- Users can cancel or edit pending/confirmed reservations at least 1 day (>24 hours) before the reservation date
- The server has already computed [canEdit/cancel: true/false] and [Xh until reservation] for each booking — use these values directly, do NOT recalculate yourself
- If canEdit/cancel is false, tell the user they cannot cancel/edit and the cutoff has passed
- If canEdit/cancel is true, proceed with the action
- If the user has 3 active reservations, tell them they must cancel one before booking again
- Always use relative paths for internal links (e.g. /booking?shop=ID&service=ID, /shop/ID, /mybookings) — NEVER prefix them with any domain name
- If TikTok links are available and the user asks for them, list them clearly
- If you don't know something, say so honestly — don't make up shop names or prices
- Keep answers concise and friendly. Respond in the same language the user uses (Thai or English)

BOOKING FLOW — MANDATORY STEPS (follow in order, never skip):
1. User mentions a shop they want to book → List ALL services at that shop with name, duration, price, and booking link. Ask which service they want.
2. User picks a service AND gives a date/time → Confirm the details (shop, service, date, time) and ask for confirmation.
3. User confirms (yes/ใช่/ยืนยัน/ok/โอเค) → Emit [[BOOK:...]] action.

⚠️ CRITICAL BOOKING RULES:
- NEVER skip step 1. Even if the user says "จองเลย" or gives a time immediately, you MUST list services first and ask them to choose.
- NEVER emit [[BOOK:...]] without a serviceId the user explicitly selected.
- If the user names a service type (e.g. "นวดไทย") without first seeing the list, show the full list and highlight which one matches.
- Always ask "คุณต้องการบริการไหน?" or similar before proceeding to date/time confirmation.

BOOKING ACTION:
When the user confirms they want to book a specific service at a specific shop at a specific time,
respond with ONLY this exact JSON on its own line (nothing else on that line):
[[BOOK:{"shopId":"SHOP_ID","serviceId":"SERVICE_ID","resvDate":"ISO_DATETIME"}]]
Then on the next line, add a friendly confirmation message saying the booking is being processed.
Use the shopId and serviceId from the retrieved context above.
For the resvDate, use today's date with the requested time in ISO 8601 format with Bangkok timezone offset (+07:00).
IMPORTANT: Bangkok is GMT+7. Examples:
- "3 PM" today (April 18, 2026) → "2026-04-18T15:00:00+07:00"
- "บ่ายโมง" (1 PM) → "T13:00:00+07:00"
- "บ่ายสาม" (3 PM) → "T15:00:00+07:00"
- "สิบโมงเช้า" (10 AM) → "T10:00:00+07:00"
Never emit UTC (Z suffix) — always use +07:00.
Only emit [[BOOK:...]] when the user has explicitly confirmed (said yes/ใช่/ยืนยัน/confirm/ok/โอเค etc.) AND you have both shopId and serviceId available.
Never make up IDs — only use IDs from the retrieved context.

EDIT ACTION:
When the user confirms they want to change the date/time of a specific reservation,
respond with ONLY this exact JSON on its own line:
[[EDIT:{"reservationId":"RESERVATION_ID","resvDate":"ISO_DATETIME"}]]
Then on the next line, add a friendly message saying the change is being processed.
Use the reservation ID from the USER RESERVATION STATUS block.
For the new resvDate, use the requested date/time in ISO 8601 format with Bangkok timezone offset (+07:00).
IMPORTANT: Bangkok is GMT+7. Examples:
- "3 PM" on April 22, 2026 → "2026-04-22T15:00:00+07:00"
- "8:30 AM" on April 20, 2026 → "2026-04-20T08:30:00+07:00"
- "noon" on April 25, 2026 → "2026-04-25T12:00:00+07:00"
Only emit [[EDIT:...]] when the user has explicitly confirmed the new time AND you have the reservation ID.
Same 1-day rule applies: only emit [[EDIT:...]] if [canEdit/cancel: true] for that reservation.

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
