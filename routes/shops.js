const express = require('express');
const { getShops, getShop, createShop, updateShop, deleteShop, getShopAreas } = require('../controllers/shops');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router({ mergeParams: true });

// Re-route into other resource routers
const serviceRouter = require('./services');
router.use('/:shopId/services', serviceRouter);

router.route('/')
    .get(getShops)
    .post(protect, authorize('admin'), createShop);

router.route('/areas')
    .get(getShopAreas);

router.route('/:id')
    .get(getShop)
    .put(protect, authorize('admin'), updateShop)
    .delete(protect, authorize('admin'), deleteShop);

module.exports = router;