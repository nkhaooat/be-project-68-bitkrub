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

const app = express();

//Body parser
app.use(express.json());

//Cookie parser
app.use(cookieParser());

//Enable CORS
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://fe-project-68-addressme.vercel.app',
    'https://*.vercel.app'
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

// Mount routers
app.use('/api/v1/shops', shops);
app.use('/api/v1/services', services);
app.use('/api/v1/auth', auth);
app.use('/api/v1/reservations', reservations);

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