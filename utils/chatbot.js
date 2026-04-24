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
const { ensureThaiTranslation } = require('../services/translation');
const { haversineKm, detectGeoAnchor } = require('./geo/chatbotGeo');
const { buildSystemPrompt, buildReservationBlock, buildWeatherBlock } = require('./prompts/chatbot-system');

// ---------------------------------------------------------------------------
// Vector store (in-memory)
// ---------------------------------------------------------------------------
let vectorStore = []; // [{ text, embedding: number[], metadata }]
let storeReady = false;
let buildPromise = null;
let lastBuiltAt = 0; // timestamp of last successful build
const STALE_TTL_MS = 30 * 60 * 1000; // 30 minutes — rebuild if older

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
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: isArray ? input : [input],
    });
    const vecs = response.data.map((d) => d.embedding);
    return isArray ? vecs : vecs[0];
  } catch (err) {
    if (err.status === 429 || err.code === 'insufficient_quota') {
      console.error('[chatbot] OpenAI API quota exceeded. Check billing at https://platform.openai.com/account/billing');
      throw new Error('Embedding failed: OpenAI API quota exceeded. Please check your billing settings.');
    }
    if (err.status === 401 || err.code === 'invalid_api_key') {
      console.error('[chatbot] Invalid OpenAI API key. Check OPENAI_API_KEY environment variable.');
      throw new Error('Embedding failed: Invalid API key. Please verify your OPENAI_API_KEY.');
    }
    console.error('[chatbot] Embedding error:', err.message);
    throw new Error(`Embedding failed: ${err.message}`);
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
        metadata: {
          type: 'shop',
          shopId,
          shopName: shop.name,
          tiktokLinks,
          lat: shop.coordinates?.lat ?? null,
          lng: shop.coordinates?.lng ?? null,
          area: shop.searchArea || null,
          areaTh: thai?.searchAreaTh || null,
        },
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
            lat: shop.coordinates?.lat ?? null,
            lng: shop.coordinates?.lng ?? null,
            area: shop.searchArea || null,
            areaTh: thai?.searchAreaTh || null,
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
    try {
      for (let i = 0; i < docs.length; i += BATCH) {
        const batch = docs.slice(i, i + BATCH);
        const texts = batch.map((d) => d.text);
        const embeddings = await embed(texts);
        for (let j = 0; j < batch.length; j++) {
          vectorStore.push({ ...batch[j], embedding: embeddings[j] });
        }
      }
      storeReady = true;
      lastBuiltAt = Date.now();
      console.log(`[chatbot] Vector store ready — ${vectorStore.length} chunks indexed.`);
    } catch (err) {
      console.error('[chatbot] Failed to build vector store:', err.message);
      storeReady = true;
    }
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
// Shop-pinning: resolve which shop the user is currently discussing
// ---------------------------------------------------------------------------

/**
 * Resolve the "pinned shop" — the shop the user is currently asking about.
 * Strategy 1: extract shopId from /shop/:id URLs in recent history
 * Strategy 2: fall back to longest name match in DB
 *
 * @param {string} userMessage
 * @param {{ role: string, content: string }[]} history
 * @returns {Promise<{ shop: object, services: object[], shopPinBlock: string, pinnedServiceNote: string } | null>}
 */
async function resolvePinnedShop(userMessage, history) {
  const recentMessages = history.slice(-8).map(m => m.content);
  const recentText = recentMessages.join('\n') + '\n' + userMessage;

  let mentionedShop = null;

  try {
    const shopIdPattern = /\/shop\/([a-f0-9]{24})/gi;
    const allShopIds = [...recentText.matchAll(shopIdPattern)].map(m => m[1]);
    const uniqueShopIds = [...new Set(allShopIds)];

    if (uniqueShopIds.length === 1) {
      mentionedShop = await MassageShop.findById(uniqueShopIds[0], '_id name searchArea openTime closeTime priceRangeMin priceRangeMax rating map').lean();
    } else if (uniqueShopIds.length > 1) {
      const candidates = await MassageShop.find(
        { _id: { $in: uniqueShopIds } },
        '_id name searchArea openTime closeTime priceRangeMin priceRangeMax rating map'
      ).lean();
      const userMsgLC = userMessage.toLowerCase();
      mentionedShop = candidates
        .map(s => {
          const words = s.name.toLowerCase().split(/\s+/);
          const score = words.filter(w => w.length > 3 && userMsgLC.includes(w)).length;
          return { shop: s, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.shop
        || candidates.find(s => s._id.toString() === allShopIds[allShopIds.length - 1]);
    } else {
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

    if (!mentionedShop) return null;

    const svcs = await MassageService.find({ shop: mentionedShop._id }, '_id name duration price description').lean();
    const svcLines = svcs.map(s =>
      `  - [serviceId:${s._id}] ${s.name} | ${s.duration} min | ฿${s.price}${s.description ? ' | ' + s.description : ''}`
    ).join('\n');

    const serviceIdMatch = recentText.match(/[?&]service=([a-f0-9]{24})/i);
    const pinnedServiceNote = serviceIdMatch
      ? `\n\nIMPORTANT: The user is specifically asking about serviceId ${serviceIdMatch[1]} — use ONLY this service ID for booking.`
      : '';

    const shopPinBlock = `
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

    return { shop: mentionedShop, services: svcs, shopPinBlock, pinnedServiceNote };
  } catch (e) {
    return null;
  }
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
async function chat(userMessage, history = [], userContext = null, weather = null, userCoords = null) {
  if (!storeReady || (lastBuiltAt && Date.now() - lastBuiltAt > STALE_TTL_MS)) {
    if (Date.now() - lastBuiltAt > STALE_TTL_MS) {
      console.log('[chatbot] Vector store is stale (>30 min), rebuilding...');
      resetVectorStore();
    }
    await buildVectorStore();
  }

  const queryEmbedding = await embed(userMessage);

  // Retrieve relevant chunks — filter out service chunks from other shops when a shop is pinned
  const anchor = detectGeoAnchor(userMessage, userCoords);
  let allHits = retrieve(queryEmbedding, anchor ? 40 : 12);
  if (anchor && typeof anchor.lat === 'number' && typeof anchor.lng === 'number') {
    allHits = allHits
      .map(h => {
        const lat = h.metadata?.lat;
        const lng = h.metadata?.lng;
        let geoBoost = 0;
        if (typeof lat === 'number' && typeof lng === 'number') {
          const dKm = haversineKm(anchor.lat, anchor.lng, lat, lng);
          const maxKm = 7, strongKm = 3;
          if (dKm <= maxKm) {
            const t = Math.max(0, Math.min(1, (maxKm - dKm) / (maxKm - strongKm)));
            geoBoost = 0.35 + 0.65 * t;
          }
        }
        const blended = 0.65 * h.score + 0.35 * geoBoost;
        return { ...h, score: blended };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }

  // Resolve pinned shop
  const pinResult = await resolvePinnedShop(userMessage, history);
  const shopPinBlock = pinResult?.shopPinBlock || '';

  // Filter retrieved chunks: when a shop is pinned, drop service chunks from OTHER shops
  const hits = pinResult?.shop
    ? allHits.filter(h =>
        h.metadata?.type !== 'service' || h.metadata?.shopId === pinResult.shop._id.toString()
      )
    : allHits;

  // Annotate context with distance from anchor point (so chatbot knows actual distances)
  const context = hits.map((h) => {
    let distTag = '';
    if (anchor && typeof anchor.lat === 'number' && typeof anchor.lng === 'number') {
      const hLat = h.metadata?.lat;
      const hLng = h.metadata?.lng;
      if (typeof hLat === 'number' && typeof hLng === 'number') {
        const dKm = haversineKm(anchor.lat, anchor.lng, hLat, hLng);
        distTag = `\n[Distance from ${anchor.labels?.[0] || 'your location'}: ${dKm < 1 ? Math.round(dKm * 1000) + 'm' : dKm.toFixed(1) + 'km'}]`;
      }
    }
    return h.text + distTag;
  }).join('\n\n---\n\n');
  const reservationBlock = buildReservationBlock(userContext);
  const weatherBlock = buildWeatherBlock(weather);

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
  const nowISO = nowDate.toISOString();

  const systemPrompt = buildSystemPrompt({ now, nowISO, weatherBlock, shopPinBlock, reservationBlock, context });
  const messages = prepareMessages(systemPrompt, history, userMessage);

  // --- Call OpenAI with graceful fallback ---
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1200,
      temperature: 0.4,
    });
    return completion.choices[0].message.content;
  } catch (err) {
    console.error('[chatbot] OpenAI completion error:', err.message);
    if (err.status === 429 || err.code === 'insufficient_quota') {
      return 'I\'m currently experiencing high demand. Please try again in a moment. ขออภัย ระบบมีผู้ใช้งานมาก กรุณาลองใหม่อีกครั้งครับ';
    }
    if (err.status === 401) {
      return 'I\'m having trouble connecting to my service. The team has been notified. ระบบขัดข้องชั่วคราว ขออภัยในความไม่สะดวกครับ';
    }
    return 'Sorry, I encountered an error. Please try again. ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่ครับ';
  }
}

// ---------------------------------------------------------------------------
// Helper: prepare messages array (shared by chat + chatStream)
// ---------------------------------------------------------------------------

async function prepareMessages(systemPrompt, history, userMessage) {
  let chatHistory = history;
  if (chatHistory.length > 10) {
    const head = chatHistory.slice(0, 2);
    const tail = chatHistory.slice(-8);
    const middle = chatHistory.slice(2, -8);
    if (middle.length > 0) {
      try {
        const summaryResp = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Summarize this conversation in 2-3 sentences. Keep key facts (shop names, service IDs, dates, reservation IDs). Reply in the same language as the conversation.' },
            ...middle,
          ],
          max_tokens: 200,
          temperature: 0,
        });
        const summary = summaryResp.choices[0].message.content;
        chatHistory = [
          ...head,
          { role: 'assistant', content: `[Earlier conversation summary: ${summary}]` },
          ...tail,
        ];
      } catch {
        chatHistory = chatHistory.slice(-10);
      }
    }
  }
  return [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    { role: 'user', content: userMessage },
  ];
}

// ---------------------------------------------------------------------------
// Streaming chat
// ---------------------------------------------------------------------------

async function* chatStream(userMessage, history = [], userContext = null, weather = null, userCoords = null) {
  if (!storeReady || (lastBuiltAt && Date.now() - lastBuiltAt > STALE_TTL_MS)) {
    if (Date.now() - lastBuiltAt > STALE_TTL_MS) {
      console.log('[chatbot] Vector store is stale (>30 min), rebuilding...');
      resetVectorStore();
    }
    await buildVectorStore();
  }

  const queryEmbedding = await embed(userMessage);

  const anchor = detectGeoAnchor(userMessage, userCoords);
  let allHits = retrieve(queryEmbedding, anchor ? 40 : 12);
  if (anchor && typeof anchor.lat === 'number' && typeof anchor.lng === 'number') {
    allHits = allHits
      .map(h => {
        const lat = h.metadata?.lat;
        const lng = h.metadata?.lng;
        let geoBoost = 0;
        if (typeof lat === 'number' && typeof lng === 'number') {
          const dKm = haversineKm(anchor.lat, anchor.lng, lat, lng);
          const maxKm = 7, strongKm = 3;
          if (dKm <= maxKm) {
            const t = Math.max(0, Math.min(1, (maxKm - dKm) / (maxKm - strongKm)));
            geoBoost = 0.35 + 0.65 * t;
          }
        }
        const blended = 0.65 * h.score + 0.35 * geoBoost;
        return { ...h, score: blended };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }

  const pinResult = await resolvePinnedShop(userMessage, history);
  const shopPinBlock = pinResult?.shopPinBlock || '';

  const hits = pinResult?.shop
    ? allHits.filter(h =>
        h.metadata?.type !== 'service' || h.metadata?.shopId === pinResult.shop._id.toString()
      )
    : allHits;

  // Annotate context with distance from anchor point
  const context = hits.map((h) => {
    let distTag = '';
    if (anchor && typeof anchor.lat === 'number' && typeof anchor.lng === 'number') {
      const hLat = h.metadata?.lat;
      const hLng = h.metadata?.lng;
      if (typeof hLat === 'number' && typeof hLng === 'number') {
        const dKm = haversineKm(anchor.lat, anchor.lng, hLat, hLng);
        distTag = `\n[Distance from ${anchor.labels?.[0] || 'your location'}: ${dKm < 1 ? Math.round(dKm * 1000) + 'm' : dKm.toFixed(1) + 'km'}]`;
      }
    }
    return h.text + distTag;
  }).join('\n\n---\n\n');
  const reservationBlock = buildReservationBlock(userContext);
  const weatherBlock = buildWeatherBlock(weather);

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
  const nowISO = nowDate.toISOString();

  const systemPrompt = buildSystemPrompt({ now, nowISO, weatherBlock, shopPinBlock, reservationBlock, context });
  const messages = await prepareMessages(systemPrompt, history, userMessage);

  let fullText = '';
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1200,
      temperature: 0.4,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        yield { type: 'token', text: delta };
      }
    }
  } catch (err) {
    console.error('[chatbot] OpenAI stream error:', err.message);
    if (err.status === 429 || err.code === 'insufficient_quota') {
      yield { type: 'error', text: 'I\'m currently experiencing high demand. Please try again in a moment.' };
    } else {
      yield { type: 'error', text: 'Sorry, I encountered an error. Please try again.' };
    }
    return;
  }

  // Parse action tags from accumulated text
  const actionPatterns = [
    { re: /\[\[BOOK:(\{[^\]]+\})\]\]/, type: 'create_reservation' },
    { re: /\[\[EDIT:(\{[^\]]+\})\]\]/, type: 'edit_reservation' },
    { re: /\[\[CANCEL:(\{[^\]]+\})\]\]/, type: 'cancel_reservation' },
  ];

  for (const { re, type } of actionPatterns) {
    const match = fullText.match(re);
    if (match) {
      try {
        const action = { type, ...JSON.parse(match[1]) };
        yield { type: 'action', action };
      } catch {
        // malformed
      }
      break;
    }
  }
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

/** Flag the vector store as stale (next chat request will rebuild) */
function markVectorStoreStale() {
  lastBuiltAt = 0;
}

module.exports = { buildVectorStore, chat, chatStream, resetVectorStore, markVectorStoreStale };
