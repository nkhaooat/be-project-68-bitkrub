const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { getMerchants, approveMerchant, rejectMerchant } = require('../controllers/merchantAdmin');

/**
 * @swagger
 * tags:
 *   name: Merchants
 *   description: Admin merchant management
 */

/**
 * @swagger
 * /api/v1/admin/merchants:
 *   get:
 *     summary: List merchant registrations (admin)
 *     tags: [Merchants]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Array of merchants }
 */

/**
 * @swagger
 * /api/v1/admin/merchants/{id}/approve:
 *   patch:
 *     summary: Approve merchant (admin)
 *     tags: [Merchants]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Merchant approved }
 */

/**
 * @swagger
 * /api/v1/admin/merchants/{id}/reject:
 *   patch:
 *     summary: Reject merchant (admin)
 *     tags: [Merchants]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Merchant rejected }
 */

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', getMerchants);
router.patch('/:id/approve', approveMerchant);
router.patch('/:id/reject', rejectMerchant);

module.exports = router;
