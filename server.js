//Set DNS
const { setServers } = require("node:dns/promises");
setServers(["1.1.1.1", "8.8.8.8"]);

const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const { globalLimiter } = require('./middleware/rateLimit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Routes
const shops = require('./routes/shops');
const services = require('./routes/services');
const auth = require('./routes/auth');
const reservations = require('./routes/reservations');
const chat = require('./routes/chat');
const reviews = require('./routes/reviews');
const promotions = require('./routes/promotions');
const qr = require('./routes/qr');
const merchants = require('./routes/merchants');
const merchant = require('./routes/merchant');

const app = express();

//Body parser
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

//Cookie parser
app.use(cookieParser());

//Enable CORS
const corsOptions = {
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:3000',
        'https://fe-project-68-addressme.vercel.app',
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Security headers
app.set('trust proxy', 1); // Render terminates TLS — trust X-Forwarded-Proto for correct req.protocol

app.use(helmet({
  contentSecurityPolicy: false, // Next.js handles its own CSP
  crossOriginEmbedderPolicy: false, // Allow Google Maps embeds
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow frontend on different port to load images
}));

// Global rate limiter
app.use(globalLimiter);

//Load env vars
dotenv.config({ path: './config/config.env' });

//Connect to database
connectDB();

// Pre-warm chatbot vector store after DB connects
const { buildVectorStore } = require('./utils/chatbot');
const { prefetchBangkok } = require('./services/weather');
setTimeout(() => {
  if (process.env.OPENAI_API_KEY) {
    buildVectorStore().catch((err) => console.error('[chatbot] pre-warm failed:', err.message));
    prefetchBangkok();
  } else {
    console.warn('[chatbot] OPENAI_API_KEY not set — vector store will build on first request');
  }
}, 3000);

// Start cron jobs
const { scheduleEmbeddingRebuild } = require('./cron/embeddingRebuild');
const { startQrExpiryCron } = require('./cron/qrExpiry');
setTimeout(() => scheduleEmbeddingRebuild(), 5000);
startQrExpiryCron();

// Mount routers
app.use('/api/v1/shops', shops);
app.use('/api/v1/services', services);
app.use('/api/v1/auth', auth);
app.use('/api/v1/reservations', reservations);
app.use('/api/v1/chat', chat);
app.use('/api/v1/reviews', reviews);
app.use('/api/v1/promotions', promotions);
app.use('/api/v1/qr', qr);
app.use('/api/v1/admin/merchants', merchants);
app.use('/api/v1/merchant', merchant);

// Swagger API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

// Global error handler (must be after routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log('Server running in ', process.env.NODE_ENV, ' mode on port ', PORT)
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
