const express = require('express');
const { verifyQR } = require('../controllers/reservations');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/v1/qr/verify/:token
// @access  Private (owner or admin)
router.get('/verify/:token', protect, verifyQR);

module.exports = router;
