const express = require('express');
const { getReservations, getReservation, createReservation, updateReservation, deleteReservation, uploadSlip, verifySlip } = require('../controllers/reservations');
const multer = require('multer');
const path = require('path');

// Multer config for slip uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/slips');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const allowed = /jpeg|jpg|png|webpdf/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype.split('/')[1]) || file.mimetype === 'image/webp' || file.mimetype === 'application/pdf';
        if (ext || mime) {
            cb(null, true);
        } else {
            cb(new Error('Only images (jpg, png, webp) and PDF files are allowed'));
        }
    }
});
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

// EPIC 4: Slip upload & verification
router.route('/:id/slip')
    .post(protect, upload.single('slip'), uploadSlip);

router.route('/:id/verify')
    .put(protect, authorize('admin'), verifySlip);

module.exports = router;