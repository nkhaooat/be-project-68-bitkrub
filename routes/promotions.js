const express = require('express');
const { validatePromotion, getPromotions, createPromotion, deletePromotion } = require('../controllers/promotions');
const { protect, authorize } = require('../middleware/auth');
/**
 * @swagger
 * tags:
 *   name: Promotions
 *   description: Promo codes & discount validation
 */

/**
 * @swagger
 * /api/v1/promotions/validate:
 *   post:
 *     summary: Validate promotion code and get discount
 *     tags: [Promotions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, price]
 *             properties:
 *               code: { type: string, example: "SPRING20" }
 *               price: { type: number, example: 1000 }
 *     responses:
 *       200: { description: Valid with discount calculation }
 *       404: { description: Invalid or expired code }
 */

/**
 * @swagger
 * /api/v1/promotions:
 *   get:
 *     summary: List all promotions (admin)
 *     tags: [Promotions]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Array of promotions }
 */

/**
 * @swagger
 * /api/v1/promotions/{id}:
 *   delete:
 *     summary: Delete promotion (admin)
 *     tags: [Promotions]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Promotion deleted }
 */

const router = express.Router();

// Public: validate a promotion code
router.route('/validate')
    .post(validatePromotion);

// Admin: CRUD promotions
router.route('/')
    .get(protect, authorize('admin'), getPromotions)
    .post(protect, authorize('admin'), createPromotion);

router.route('/:id')
    .delete(protect, authorize('admin'), deletePromotion);

module.exports = router;
