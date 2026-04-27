const express = require('express');
const { getServices, getService, createService, updateService, deleteService } = require('../controllers/services');
const { protect, authorize } = require('../middleware/auth');
/**
 * @swagger
 * tags:
 *   name: Services
 *   description: Massage service CRUD
 */

/**
 * @swagger
 * /api/v1/shops/{shopId}/services:
 *   get:
 *     summary: List services for a shop (public)
 *     tags: [Services]
 *     parameters:
 *       - { in: path, name: shopId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Array of services }
 *   post:
 *     summary: Create service (admin)
 *     tags: [Services]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: shopId, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: Service created }
 */

/**
 * @swagger
 * /api/v1/shops/{shopId}/services/{id}:
 *   get:
 *     summary: Get single service
 *     tags: [Services]
 *     parameters:
 *       - { in: path, name: shopId, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Service detail }
 *   put:
 *     summary: Update service (admin)
 *     tags: [Services]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Service updated }
 *   delete:
 *     summary: Delete service (admin)
 *     tags: [Services]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Service deleted }
 */

const router = express.Router({ mergeParams: true });

router.route('/')
    .get(getServices)
    .post(protect, authorize('admin'), createService);

router.route('/:id')
    .get(getService)
    .put(protect, authorize('admin'), updateService)
    .delete(protect, authorize('admin'), deleteService);

module.exports = router;