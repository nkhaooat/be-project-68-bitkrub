const express = require('express');
/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Customer reviews & ratings
 */

/**
 * @swagger
 * /api/v1/reviews:
 *   post:
 *     summary: Create review (completed booking required)
 *     tags: [Reviews]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reservationId, rating]
 *             properties:
 *               reservationId: { type: string }
 *               rating: { type: number, minimum: 1, maximum: 5 }
 *               comment: { type: string }
 *     responses:
 *       201: { description: Review created }
 *       400: { description: Already reviewed or not completed }
 */

/**
 * @swagger
 * /api/v1/reviews/my:
 *   get:
 *     summary: Get current user reviews
 *     tags: [Reviews]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Array of user reviews }
 */

/**
 * @swagger
 * /api/v1/reviews/check/{reservationId}:
 *   get:
 *     summary: Check review status for a reservation
 *     tags: [Reviews]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: reservationId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Review status }
 */

/**
 * @swagger
 * /api/v1/reviews/shop/{shopId}:
 *   get:
 *     summary: Get reviews for a shop (public)
 *     tags: [Reviews]
 *     parameters:
 *       - { in: path, name: shopId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Array of shop reviews }
 */

const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createReview,
  getShopReviews,
  getMyReviews,
  checkReview,
} = require('../controllers/reviews');

router.post('/', protect, createReview);
router.get('/my', protect, getMyReviews);
router.get('/check/:reservationId', protect, checkReview);
router.get('/shop/:shopId', getShopReviews); // public

module.exports = router;
