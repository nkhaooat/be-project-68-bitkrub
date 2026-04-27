const rateLimit = require('express-rate-limit');

// Global rate limiter (all routes)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,  // temporarily raised for E2E testing
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Chat endpoint (expensive — hits OpenAI API)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many chat messages. Please wait a moment.' },
});

// Chat streaming endpoint (more expensive — holds connection open)
const chatStreamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many streaming requests. Please wait a moment.' },
});

module.exports = { globalLimiter, chatLimiter, chatStreamLimiter };
