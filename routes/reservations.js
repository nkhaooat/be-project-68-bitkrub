const express = require('express');
const { getReservations, getReservation, createReservation, updateReservation, deleteReservation, uploadSlip, verifySlip } = require('../controllers/reservations');
const { uploadSlip: uploadSlipMiddleware } = require('../middleware/upload');
const { autoCompleteMiddleware } = require('../services/reservations');
const { protect, authorize } = require('../middleware/auth');

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
