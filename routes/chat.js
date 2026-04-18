const express = require('express');
const { chatWithBot, rebuildIndex } = require('../controllers/chat');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public: chat endpoint
router.post('/', chatWithBot);

// Admin: rebuild vector store index after data changes
router.post('/rebuild', protect, authorize('admin'), rebuildIndex);

// Test: check if server can reach GISTDA weather API
router.get('/weather-test', async (req, res) => {
  try {
    const response = await fetch(
      'https://pm25.gistda.or.th/rest/getWeatherbyArea?id=103301',
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json();
    res.json({ success: true, reachable: true, data });
  } catch (err) {
    res.json({ success: false, reachable: false, error: err.message });
  }
});

module.exports = router;
