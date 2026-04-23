const express = require('express');
const { validatePromotion, getPromotions, createPromotion, deletePromotion } = require('../controllers/promotions');
const { protect, authorize } = require('../middleware/auth');
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
