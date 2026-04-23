const express = require('express');
const { verifyQR } = require('../controllers/reservations');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/v1/qr/verify/:token
// @access  Private/Admin
router.get('/verify/:token', protect, authorize('admin'), verifyQR);

module.exports = router;
