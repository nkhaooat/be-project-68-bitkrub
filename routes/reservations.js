const express = require('express');
const { getReservations, getReservation, createReservation, updateReservation, deleteReservation, uploadSlip, verifySlip } = require('../controllers/reservations');
const { uploadSlip: uploadSlipMiddleware } = require('../middleware/upload');
const { autoCompleteMiddleware } = require('../services/reservations');
const { protect, authorize } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Reservations
 *   description: Booking, slip upload, payment verification
 */

/**
 * @swagger
 * /api/v1/reservations:
 *   get:
 *     summary: List user reservations
 *     tags: [Reservations]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Array of reservations }
 *   post:
 *     summary: Create reservation
 *     tags: [Reservations]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shop, service, resvDate, resvTime]
 *             properties:
 *               shop: { type: string }
 *               service: { type: string }
 *               resvDate: { type: string, format: date }
 *               resvTime: { type: string, example: "14:00" }
 *               promotionCode: { type: string }
 *     responses:
 *       201: { description: Reservation created with QR token }
 *       400: { description: Time conflict or validation error }
 */

/**
 * @swagger
 * /api/v1/reservations/{id}:
 *   get:
 *     summary: Get single reservation
 *     tags: [Reservations]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Reservation detail }
 *   put:
 *     summary: Update reservation
 *     tags: [Reservations]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     summary: Cancel reservation
 *     tags: [Reservations]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Cancelled }
 */

/**
 * @swagger
 * /api/v1/reservations/{id}/slip:
 *   post:
 *     summary: Upload payment slip (multipart)
 *     tags: [Reservations]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               slip: { type: string, format: binary }
 *     responses:
 *       200: { description: Slip uploaded }
 */

/**
 * @swagger
 * /api/v1/reservations/{id}/verify:
 *   put:
 *     summary: Approve or reject payment (admin)
 *     tags: [Reservations]
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [approve, reject] }
 *     responses:
 *       200: { description: Payment verified/rejected }
 */

const router = express.Router({ mergeParams: true });

router.route('/')
    .get(protect, autoCompleteMiddleware, getReservations)
    .post(protect, createReservation);

router.route('/:id')
    .get(protect, autoCompleteMiddleware, getReservation)
    .put(protect, updateReservation)
    .delete(protect, deleteReservation);

// EPIC 4: Slip upload & verification
router.route('/:id/slip')
    .post(protect, uploadSlipMiddleware.single('slip'), uploadSlip);

router.route('/:id/verify')
    .put(protect, authorize('admin'), verifySlip);

module.exports = router;
