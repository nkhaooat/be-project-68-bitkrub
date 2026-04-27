const express = require('express');
const { getShops, getShop, createShop, updateShop, deleteShop, getShopAreas,
        addTiktokLinks, updateTiktokLinks, removeTiktokLink, getShopPhoto } = require('../controllers/shops');
const { protect, authorize } = require('../middleware/auth');
/**
 * @swagger
 * tags:
 *   name: Shops
 *   description: Massage shop CRUD, Google Places & TikTok
 */

/**
 * @swagger
 * /api/v1/shops:
 *   get:
 *     summary: List all shops (public)
 *     tags: [Shops]
 *     parameters:
 *       - { in: query, name: district, schema: { type: string } }
 *       - { in: query, name: province, schema: { type: string } }
 *     responses:
 *       200: { description: Array of shops }
 */

/**
 * @swagger
 * /api/v1/shops/areas:
 *   get:
 *     summary: Get distinct shop areas
 *     tags: [Shops]
 *     responses:
 *       200: { description: Array of areas }
 */

/**
 * @swagger
 * /api/v1/shops/{id}:
 *   get:
 *     summary: Get single shop with services
 *     tags: [Shops]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Shop detail }
 *       404: { description: Not found }
 *   put:
 *     summary: Update shop (admin)
 *     tags: [Shops]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Shop updated }
 *       403: { description: Not admin }
 *   delete:
 *     summary: Delete shop (admin)
 *     tags: [Shops]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Shop deleted }
 */

/**
 * @swagger
 * /api/v1/shops/{id}/photo:
 *   get:
 *     summary: Google Places photo proxy (fallback to MongoDB)
 *     tags: [Shops]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Photo binary }
 *       302: { description: Redirect to Google photo }
 */

/**
 * @swagger
 * /api/v1/shops/{id}/tiktok:
 *   post:
 *     summary: Add TikTok links (admin)
 *     tags: [Shops]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Links added }
 *   put:
 *     summary: Update TikTok links (admin)
 *     tags: [Shops]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Links updated }
 *   delete:
 *     summary: Remove TikTok link (admin)
 *     tags: [Shops]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Link removed }
 */

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

router.route('/:id/photo')
    .get(getShopPhoto);

// TikTok link management (US1-2, US1-3, US1-4)
router.route('/:id/tiktok')
    .post(protect, authorize('admin'), addTiktokLinks)
    .put(protect, authorize('admin'), updateTiktokLinks)
    .delete(protect, authorize('admin'), removeTiktokLink);

module.exports = router;