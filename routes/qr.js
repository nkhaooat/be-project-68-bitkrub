const express = require('express');
const { verifyQR } = require('../controllers/reservations');
const { protect, authorize } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: QR
 *   description: QR code verification
 */

/**
 * @swagger
 * /api/v1/qr/verify/{token}:
 *   get:
 *     summary: Verify QR token for check-in
 *     tags: [QR]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: token, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Valid, reservation details }
 *       404: { description: Invalid or expired token }
 *       403: { description: Not authorized }
 */

const router = express.Router();

// @route   GET /api/v1/qr/verify/:token
// @access  Private (owner or admin)
router.get('/verify/:token', protect, verifyQR);

module.exports = router;
