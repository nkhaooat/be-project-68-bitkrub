require('dotenv').config({ path: `${__dirname}/../config/config.env` });
const mongoose = require('mongoose');
const MassageShop = require('../models/MassageShop');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const result = await MassageShop.updateMany(
    { searchArea: 'Rama 9' },
    { $set: { searchAreaTh: 'พระราม 9, ถนนพระราม 9, รามา 9' } }
  );
  console.log('Patched Rama 9:', result.modifiedCount, 'shops');
  await mongoose.disconnect();
}).catch(console.error);
