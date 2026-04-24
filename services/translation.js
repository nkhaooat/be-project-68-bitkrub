/**
 * Thai translation service for massage shop data.
 *
 * Ensures Thai translations exist for shop names, locations, descriptions,
 * and service names/areas. Uses GPT-4o-mini for translation and caches
 * results in MongoDB so subsequent rebuilds skip the API call.
 */

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Ensure Thai translations exist for a shop + its services.
 * - If all Thai fields are already in DB → use them (no GPT call).
 * - If any are missing → call GPT once for the whole shop, then persist to DB.
 *
 * @param {Object} shop - Mongoose shop document (lean)
 * @param {Object[]} shopServices - Mongoose service documents (lean) for this shop
 * @returns {Promise<{ shopNameTh, locationTh, descriptionTh, searchAreaTh, services: [{ nameTh, areaTh, descTh }] } | null>}
 */
async function ensureThaiTranslation(shop, shopServices) {
  const shopHasThai = shop.nameTh && shop.locationTh && shop.searchAreaTh;
  const servicesHaveThai = shopServices.every(s => s.nameTh && s.areaTh);

  if (shopHasThai && servicesHaveThai) {
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
    const MassageShop = require('../models/MassageShop');
    const MassageService = require('../models/MassageService');

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

    console.log(`[translation] Translated & cached Thai for: ${shop.name}`);
    return thai;
  } catch (e) {
    console.warn(`[translation] Thai translation failed for ${shop.name}:`, e.message);
    return null;
  }
}

module.exports = { ensureThaiTranslation };
