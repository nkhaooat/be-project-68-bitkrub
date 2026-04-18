const express = require('express');
const { getShops, getShop, createShop, updateShop, deleteShop, getShopAreas,
        addTiktokLinks, updateTiktokLinks, removeTiktokLink, updateDescription } = require('../controllers/shops');
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

// TikTok link management (US1-2, US1-3, US1-4)
router.route('/:id/tiktok')
    .post(protect, authorize('admin'), addTiktokLinks)
    .put(protect, authorize('admin'), updateTiktokLinks)
    .delete(protect, authorize('admin'), removeTiktokLink);

// Shop description management
router.route('/:id/description')
    .put(protect, authorize('admin'), updateDescription);

module.exports = router;