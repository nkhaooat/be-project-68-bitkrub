const express = require('express');
const { chatWithBot, rebuildIndex } = require('../controllers/chat');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public: chat endpoint
router.post('/', chatWithBot);

// Admin: rebuild vector store index after data changes
router.post('/rebuild', protect, authorize('admin'), rebuildIndex);

module.exports = router;
