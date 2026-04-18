const express = require('express');
const { getReservations, getReservation, createReservation, updateReservation, deleteReservation } = require('../controllers/reservations');
const { protect, authorize } = require('../middleware/auth');
const { autoCompleteMiddleware } = require('../controllers/reviews');
const router = express.Router({ mergeParams: true });

router.route('/')
    .get(protect, autoCompleteMiddleware, getReservations)
    .post(protect, createReservation);

router.route('/:id')
    .get(protect, autoCompleteMiddleware, getReservation)
    .put(protect, updateReservation)
    .delete(protect, deleteReservation);

module.exports = router;