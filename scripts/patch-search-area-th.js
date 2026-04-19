#!/usr/bin/env node
/**
 * Patch existing shops that have locationTh but missing searchAreaTh.
 * Translates searchArea to Thai and patches the DB.
 */
require('dotenv').config({ path: `${__dirname}/../config/config.env` });
const mongoose = require('mongoose');
const OpenAI = require('openai');
const MassageShop = require('../models/MassageShop');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Known mappings (fast path, avoids GPT for common areas)
const AREA_MAP = {
  'Khao San':   'ข้าวสาร, ถนนข้าวสาร, เขาสาน',
  'Sukhumvit':  'สุขุมวิท, ถนนสุขุมวิท',
  'Silom':      'สีลม, ถนนสีลม',
  'Asoke':      'อโศก, อโศกมนตรี, สุขุมวิทอโศก',
  'Thonglor':   'ทองหล่อ, ถนนทองหล่อ',
  'Ekkamai':    'เอกมัย, ถนนเอกมัย',
  'Ari':        'อารี, ถนนอารี',
  'Sathorn':    'สาทร, ถนนสาทร',
  'Ratchada':   'รัชดา, ถนนรัชดา, รัชดาภิเษก',
  'Lat Phrao':  'ลาดพร้าว, ถนนลาดพร้าว',
  'On Nut':     'อ่อนนุช, ถนนอ่อนนุช',
  'Phrom Phong':'พร้อมพงษ์',
  'MBK':        'มาบุญครอง, สยาม, เอ็มบีเค',
  'Siam':       'สยาม, ย่านสยาม',
  'Chatuchak':  'จตุจักร, ถนนจตุจักร',
  'Nana':       'นานา, ถนนนานา',
  'Chidlom':    'ชิดลม, ย่านชิดลม',
  'Phra Nakhon':'พระนคร, เขตพระนคร',
};

async function translateArea(searchArea) {
  if (AREA_MAP[searchArea]) return AREA_MAP[searchArea];
  
  // Fall back to GPT for unmapped areas
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: `Translate this Bangkok neighborhood name to Thai, include common aliases separated by commas. Reply ONLY the Thai text, nothing else: "${searchArea}"` }],
    temperature: 0,
  });
  return resp.choices[0].message.content.trim();
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find shops missing searchAreaTh but have a searchArea
  const shops = await MassageShop.find({
    searchArea: { $exists: true, $ne: null },
    $or: [
      { searchAreaTh: null },
      { searchAreaTh: { $exists: false } },
      { searchAreaTh: '' },
    ]
  }).lean();

  console.log(`Found ${shops.length} shops needing searchAreaTh patch`);

  for (const shop of shops) {
    const searchAreaTh = await translateArea(shop.searchArea);
    await MassageShop.updateOne(
      { _id: shop._id },
      { $set: { searchAreaTh } }
    );
    console.log(`  ✓ ${shop.name} (${shop.searchArea}) → ${searchAreaTh}`);
  }

  console.log('\nDone!');
  await mongoose.disconnect();
}

main().catch(console.error);
