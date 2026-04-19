require('dotenv').config({ path: `${__dirname}/../config/config.env` });
const mongoose = require('mongoose');
const MassageShop = require('../models/MassageShop');

// Complete area map — no GPT needed
const AREA_MAP = {
  'Khao San':    'ข้าวสาร, ถนนข้าวสาร, เขาสาน',
  'Sukhumvit':   'สุขุมวิท, ถนนสุขุมวิท',
  'Silom':       'สีลม, ถนนสีลม',
  'Asoke':       'อโศก, อโศกมนตรี, สุขุมวิทอโศก',
  'Thonglor':    'ทองหล่อ, ถนนทองหล่อ',
  'Ekkamai':     'เอกมัย, ถนนเอกมัย',
  'Ari':         'อารี, ถนนอารี',
  'Sathorn':     'สาทร, ถนนสาทร',
  'Ratchada':    'รัชดา, ถนนรัชดา, รัชดาภิเษก',
  'Lat Phrao':   'ลาดพร้าว, ถนนลาดพร้าว',
  'On Nut':      'อ่อนนุช, ถนนอ่อนนุช',
  'Phrom Phong': 'พร้อมพงษ์',
  'MBK':         'มาบุญครอง, สยาม, เอ็มบีเค',
  'Siam':        'สยาม, ย่านสยาม',
  'Chatuchak':   'จตุจักร, ถนนจตุจักร',
  'Nana':        'นานา, ถนนนานา',
  'Chidlom':     'ชิดลม, ย่านชิดลม',
  'Phra Nakhon': 'พระนคร, เขตพระนคร',
  'Bearing':     'แบริ่ง, ถนนแบริ่ง',
  'Bangna':      'บางนา, ถนนบางนา',
  'Udom Suk':    'อุดมสุข, ถนนอุดมสุข',
  'Bang Chak':   'บางจาก, ถนนบางจาก',
  'Punnawithi':  'พุทธบูชา, ปุณณวิถี',
  'Onnut':       'อ่อนนุช, ถนนอ่อนนุช',
  'Bangkae':     'บางแค, ย่านบางแค',
  'Victory Monument': 'อนุสาวรีย์ชัยสมรภูมิ, วิคตอรี่',
  'Ari':         'อารี, ย่านอารี',
  'Saphan Kwai': 'สะพานควาย',
  'Mo Chit':     'หมอชิต, ถนนหมอชิต',
  'Lad Phrao':   'ลาดพร้าว, ถนนลาดพร้าว',
};

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const shops = await MassageShop.find({
    searchArea: { $exists: true, $ne: null },
    $or: [
      { searchAreaTh: null },
      { searchAreaTh: { $exists: false } },
      { searchAreaTh: '' },
    ]
  }, 'name searchArea').lean();

  console.log(`Found ${shops.length} remaining shops to patch`);
  const missingAreas = new Set();

  for (const shop of shops) {
    const th = AREA_MAP[shop.searchArea];
    if (th) {
      await MassageShop.updateOne({ _id: shop._id }, { $set: { searchAreaTh: th } });
      console.log(`  ✓ ${shop.name} (${shop.searchArea}) → ${th}`);
    } else {
      missingAreas.add(shop.searchArea);
      console.log(`  ? ${shop.name} — unmapped area: ${shop.searchArea}`);
    }
  }

  if (missingAreas.size > 0) {
    console.log('\nUnmapped areas (add to AREA_MAP):', [...missingAreas]);
  }

  console.log('\nDone!');
  await mongoose.disconnect();
}

main().catch(console.error);
