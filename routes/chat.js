const express = require('express');
const { chatWithBot, chatStreamBot, rebuildIndex } = require('../controllers/chat');
const { protect, authorize } = require('../middleware/auth');
const { chatLimiter, chatStreamLimiter } = require('../middleware/rateLimit');

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: AI chatbot with RAG
 */

/**
 * @swagger
 * /api/v1/chat:
 *   post:
 *     summary: Send message to AI chatbot
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, example: "Thai massage near Sukhumvit" }
 *     responses:
 *       200: { description: AI response }
 */

/**
 * @swagger
 * /api/v1/chat/stream:
 *   post:
 *     summary: Stream AI response (SSE)
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *     responses:
 *       200: { description: SSE stream }
 */

/**
 * @swagger
 * /api/v1/chat/rebuild:
 *   post:
 *     summary: Rebuild vector store (admin)
 *     tags: [Chat]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Index rebuilt }
 */

const router = express.Router();

// Public: chat endpoint (rate-limited)
router.post('/', chatLimiter, chatWithBot);
router.post('/stream', chatStreamLimiter, chatStreamBot);

// Admin: rebuild vector store index after data changes
router.post('/rebuild', protect, authorize('admin'), rebuildIndex);

module.exports = router;
