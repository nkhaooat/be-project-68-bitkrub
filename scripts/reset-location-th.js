require('dotenv').config({ path: `${__dirname}/../config/config.env` });
const mongoose = require('mongoose');
const MassageShop = require('../models/MassageShop');

// Reset locationTh so next rebuild re-translates it as the address
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const result = await MassageShop.updateMany({}, { $set: { locationTh: null } });
  console.log(`Reset locationTh on ${result.modifiedCount} shops — will be re-translated as address on next rebuild`);
  await mongoose.disconnect();
}).catch(console.error);
