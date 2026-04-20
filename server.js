//Set DNS
const { setServers } = require("node:dns/promises");
setServers(["1.1.1.1", "8.8.8.8"]);

const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const shops = require('./routes/shops');
const services = require('./routes/services');
const auth = require('./routes/auth');
const reservations = require('./routes/reservations');
const chat = require('./routes/chat');
const reviews = require('./routes/reviews');

const app = express();

//Body parser
app.use(express.json());

//Cookie parser
app.use(cookieParser());

//Enable CORS
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://fe-project-68-addressme.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

//Load env vars
dotenv.config({ path: './config/config.env' });

//Connect to database
connectDB();

// Pre-warm chatbot vector store after DB connects
const { buildVectorStore, resetVectorStore } = require('./utils/chatbot');
setTimeout(() => {
  if (process.env.OPENAI_API_KEY) {
    buildVectorStore().catch((err) => console.error('[chatbot] pre-warm failed:', err.message));
  } else {
    console.warn('[chatbot] OPENAI_API_KEY not set — vector store will build on first request');
  }
}, 3000);

// ---------------------------------------------------------------------------
// Daily cron: rebuild embedding at 12:00 PM Bangkok time when new data exists
// ---------------------------------------------------------------------------
const MassageShop = require('./models/MassageShop');
const MassageService = require('./models/MassageService');

let lastEmbeddingRebuild = new Date(0); // epoch = never rebuilt

function scheduleMidnightRebuild() {
  const now = new Date();
  // Compute next midnight Bangkok (00:00 UTC+7 = 17:00 UTC previous day)
  const bangkokOffset = 7 * 60 * 60 * 1000;
  const nowBangkok = new Date(now.getTime() + bangkokOffset);
  const nextMidnight = new Date(nowBangkok);
  nextMidnight.setUTCHours(17, 0, 0, 0); // 00:00 Bangkok = 17:00 UTC (previous day)
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1); // Always tomorrow midnight
  const msUntilMidnight = nextMidnight.getTime() - now.getTime();
  console.log(`[cron] Next embedding rebuild check scheduled in ${Math.round(msUntilMidnight / 60000)} minutes (midnight Bangkok).`);

  setTimeout(async () => {
    try {
      // Check if any new data since last rebuild
      const since = lastEmbeddingRebuild;
      const newShops = await MassageShop.countDocuments({ createdAt: { $gt: since } });
      const newServices = await MassageService.countDocuments({ createdAt: { $gt: since } });
      if (newShops > 0 || newServices > 0) {
        console.log(`[cron] Found ${newShops} new shop(s) and ${newServices} new service(s) since last rebuild. Rebuilding embedding...`);
        resetVectorStore();
        await buildVectorStore();
        lastEmbeddingRebuild = new Date();
        console.log('[cron] Embedding rebuild complete.');
      } else {
        console.log('[cron] No new data since last rebuild — skipping embedding rebuild.');
      }
    } catch (err) {
      console.error('[cron] Embedding rebuild failed:', err.message);
    }
    // Schedule next midnight check
    scheduleMidnightRebuild();
  }, msUntilMidnight);
}

// Start the midnight cron after DB connects (give it 5s)
setTimeout(() => scheduleMidnightRebuild(), 5000);

// Mount routers
app.use('/api/v1/shops', shops);
app.use('/api/v1/services', services);
app.use('/api/v1/auth', auth);
app.use('/api/v1/reservations', reservations);
app.use('/api/v1/chat', chat);
app.use('/api/v1/reviews', reviews);

// API root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Dungeon Inn API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      shops: '/api/v1/shops',
      services: '/api/v1/services',
      reservations: '/api/v1/reservations'
    }
  });
});

const PORT= process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log('Server running in ', process.env.NODE_ENV, ' mode on port ', PORT)
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});