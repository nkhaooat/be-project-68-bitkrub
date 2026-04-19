const mongoose = require('mongoose');
const MassageService = require('./models/MassageService');
const MassageShop = require('./models/MassageShop');

async function checkDuplicates() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dungeon_inn');
    console.log('Connected to MongoDB\n');
    
    // Find Iris Thai Massage shop
    const irisShop = await MassageShop.findOne({ name: /Iris Thai Massage/i });
    if (!irisShop) {
      console.log('Iris Thai Massage shop not found');
      return;
    }
    
    console.log('Found shop:', irisShop.name);
    console.log('Shop ID:', irisShop._id.toString());
    
    // Find all services for this shop
    const services = await MassageService.find({ shop: irisShop._id }).sort({ name: 1 });
    console.log('\nTotal services for this shop:', services.length);
    
    // Find duplicates (same name, duration, price)
    const duplicates = [];
    const seen = new Map();
    
    services.forEach(service => {
      const key = `${service.name}|${service.duration}|${service.price}`;
      if (seen.has(key)) {
        duplicates.push({
          original: seen.get(key),
          duplicate: service
        });
      } else {
        seen.set(key, service);
      }
    });
    
    console.log('\nDuplicate services found:', duplicates.length);
    
    if (duplicates.length > 0) {
      console.log('\nDuplicate entries:');
      duplicates.forEach((dup, i) => {
        console.log(`\n${i + 1}. ${dup.duplicate.name}`);
        console.log('   Original ID:', dup.original._id.toString());
        console.log('   Duplicate ID:', dup.duplicate._id.toString());
        console.log('   Duration:', dup.duplicate.duration, 'min');
        console.log('   Price: ฿', dup.duplicate.price);
      });
      
      // Ask to remove duplicates
      console.log('\nTo remove duplicates, run:');
      console.log('node remove_duplicate_services.js');
    }
    
    // Show all unique services
    console.log('\n\nUnique services for this shop:');
    seen.forEach((service, key) => {
      console.log(`- ${service.name} (${service.duration}min) - ฿${service.price}`);
    });
    
  } catch(e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

checkDuplicates();
