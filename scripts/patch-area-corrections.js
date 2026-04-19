require('dotenv').config({ path: `${__dirname}/../config/config.env` });
const mongoose = require('mongoose');
const MassageShop = require('../models/MassageShop');

const PATCHES = [
  { searchArea: 'Siam',     searchAreaTh: 'สยาม, สยามสแควร์, จุฬา' },
  { searchArea: 'Khao San', searchAreaTh: 'ข้าวสาร, ถนนข้าวสาร' },
  { searchArea: 'Silom',    searchAreaTh: 'สีลม, ถนนสีลม, พัฒน์พงศ์, ถนนพัฒน์พงศ์' },
];

mongoose.connect(process.env.MONGO_URI).then(async () => {
  for (const { searchArea, searchAreaTh } of PATCHES) {
    const result = await MassageShop.updateMany({ searchArea }, { $set: { searchAreaTh } });
    console.log(`${searchArea} → ${searchAreaTh} (${result.modifiedCount} shops)`);
  }
  await mongoose.disconnect();
  console.log('Done!');
}).catch(console.error);
