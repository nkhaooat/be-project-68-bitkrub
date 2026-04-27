const express = require('express');
const { protect, requireMerchant } = require('../middleware/auth');
const {
  getMerchantDashboard,
  updateMerchantShop,
  getMerchantReservations,
  getMerchantServices,
  createMerchantService,
  updateMerchantService,
  deleteMerchantService,
  scanQR,
  updateReservationStatus
} = require('../controllers/merchantSelfService');

/**
 * @swagger
 * tags:
 *   name: Merchant
 *   description: Merchant self-service dashboard
 */

/**
 * @swagger
 * /api/v1/merchant/dashboard:
 *   get:
 *     summary: Get merchant dashboard
 *     tags: [Merchant]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Shop stats and bookings }
 *       403: { description: Not approved merchant }
 */

/**
 * @swagger
 * /api/v1/merchant/shop:
 *   put:
 *     summary: Update own shop
 *     tags: [Merchant]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Shop updated }
 */

/**
 * @swagger
 * /api/v1/merchant/services:
 *   get:
 *     summary: List own services
 *     tags: [Merchant]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Array of services }
 *   post:
 *     summary: Create service
 *     tags: [Merchant]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       201: { description: Service created }
 */

/**
 * @swagger
 * /api/v1/merchant/services/{id}:
 *   put:
 *     summary: Update service
 *     tags: [Merchant]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Service updated }
 *   delete:
 *     summary: Delete service
 *     tags: [Merchant]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Service deleted }
 */

/**
 * @swagger
 * /api/v1/merchant/reservations:
 *   get:
 *     summary: List own reservations
 *     tags: [Merchant]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Array of reservations }
 */

/**
 * @swagger
 * /api/v1/merchant/reservations/{id}/status:
 *   put:
 *     summary: Update reservation status
 *     tags: [Merchant]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Status updated }
 */

/**
 * @swagger
 * /api/v1/merchant/qr/scan:
 *   post:
 *     summary: Scan QR for check-in
 *     tags: [Merchant]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200: { description: Session confirmed }
 *       404: { description: Invalid token }
 */

const router = express.Router();

// All routes require merchant approval
router.use(protect, requireMerchant());

// Dashboard — own shop info
router.get('/dashboard', getMerchantDashboard);

// Update own shop
router.put('/shop', updateMerchantShop);

// Manage own services
router.get('/services', getMerchantServices);
router.post('/services', createMerchantService);
router.put('/services/:id', updateMerchantService);
router.delete('/services/:id', deleteMerchantService);

// View reservations for own shop
router.get('/reservations', getMerchantReservations);

// Update reservation status (own shop only)
router.put('/reservations/:id/status', updateReservationStatus);

// Scan QR code
router.post('/qr/scan', scanQR);

module.exports = router;
