const express = require('express');
const { chatWithBot, chatStreamBot, rebuildIndex } = require('../controllers/chat');
const { protect, authorize } = require('../middleware/auth');
const { chatLimiter, chatStreamLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Public: chat endpoint (rate-limited)
router.post('/', chatLimiter, chatWithBot);
router.post('/stream', chatStreamLimiter, chatStreamBot);

// Admin: rebuild vector store index after data changes
router.post('/rebuild', protect, authorize('admin'), rebuildIndex);

module.exports = router;
