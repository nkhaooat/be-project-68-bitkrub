const express = require('express');
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
