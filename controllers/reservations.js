const Reservation = require('../models/Reservation');
const MassageShop = require('../models/MassageShop');
const MassageService = require('../models/MassageService');
const crypto = require('crypto');

// @desc    Get all reservations (admin) or user's reservations
// @route   GET /api/v1/reservations
// @access  Private
exports.getReservations = async (req, res, next) => {
    try {
        let query;
        
        // Check if user wants to see only their own bookings (myBookings=true)
        const myBookingsOnly = req.query.myBookings === 'true';
        
        if (req.user.role === 'admin' && !myBookingsOnly) {
            // Admin can see all reservations with filters (when accessing admin panel)
            let reqQuery = { ...req.query };
            const removeFields = ['select', 'sort', 'page', 'limit', 'myBookings'];
            removeFields.forEach(param => delete reqQuery[param]);

            // Date range filter
            if (req.query.startDate || req.query.endDate) {
                reqQuery.resvDate = {};
                if (req.query.startDate) reqQuery.resvDate.$gte = new Date(req.query.startDate);
                if (req.query.endDate) reqQuery.resvDate.$lte = new Date(req.query.endDate);
                delete reqQuery.startDate;
                delete reqQuery.endDate;
            }

            let queryStr = JSON.stringify(reqQuery);
            queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
            query = Reservation.find(JSON.parse(queryStr));
        } else {
            // Regular user or admin viewing "My Bookings" - show only their own reservations
            query = Reservation.find({ user: req.user.id });
        }

        query = query.populate([
            { path: 'shop', select: 'name address location tel' },
            { path: 'service', select: 'name area duration oil price' },
            { path: 'user', select: 'name email telephone' }
        ]);

        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-resvDate');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = await Reservation.countDocuments(req.user.role === 'admin' ? {} : { user: req.user.id });

        query = query.skip(startIndex).limit(limit);

        const reservations = await query;

        const pagination = {
            total,
            page,
            pages: Math.ceil(total / limit),
            limit
        };

        res.status(200).json({
            success: true,
            count: reservations.length,
            pagination,
            data: reservations
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get single reservation
// @route   GET /api/v1/reservations/:id
// @access  Private
exports.getReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id).populate([
            { path: 'shop', select: 'name address location tel openTime closeTime' },
            { path: 'service', select: 'name area duration oil price sessions' },
            { path: 'user', select: 'name email telephone' }
        ]);

        if (!reservation) {
            return res.status(404).json({ success: false, message: `Reservation not found with id of ${req.params.id}` });
        }

        // Check if user owns this reservation or is admin
        if (reservation.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to access this reservation' });
        }

        res.status(200).json({ success: true, data: reservation });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Create new reservation
// @route   POST /api/v1/reservations
// @access  Private
exports.createReservation = async (req, res, next) => {
    try {
        // Check if user already has 3 active reservations
        const activeReservations = await Reservation.countDocuments({
            user: req.user.id,
            status: { $in: ['pending', 'confirmed'] },
            resvDate: { $gte: new Date() }
        });

        if (activeReservations >= 3) {
            return res.status(400).json({ 
                success: false, 
                message: 'You can only have up to 3 active reservations. Please cancel an existing reservation first.' 
            });
        }

        // Check if shop exists
        const shop = await MassageShop.findById(req.body.shop);
        if (!shop) {
            return res.status(404).json({ success: false, message: `Shop not found with id of ${req.body.shop}` });
        }

        // Check if service exists and belongs to the shop
        const service = await MassageService.findById(req.body.service);
        if (!service) {
            return res.status(404).json({ success: false, message: `Service not found with id of ${req.body.service}` });
        }
        if (service.shop.toString() !== req.body.shop) {
            return res.status(400).json({ success: false, message: 'Service does not belong to the selected shop' });
        }

        // Check for time-overlap with the user's existing active reservations
        // A reservation occupies [resvDate, resvDate + duration minutes)
        const newStart = new Date(req.body.resvDate);
        const newEnd = new Date(newStart.getTime() + service.duration * 60 * 1000);

        const existingReservations = await Reservation.find({
            user: req.user.id,
            status: { $in: ['pending', 'confirmed'] }
        }).populate('service', 'duration');

        for (const existing of existingReservations) {
            const existingStart = new Date(existing.resvDate);
            const existingDuration = existing.service?.duration || 60;
            const existingEnd = new Date(existingStart.getTime() + existingDuration * 60 * 1000);

            // Check overlap: new reservation starts before existing ends AND ends after existing starts
            if (newStart < existingEnd && newEnd > existingStart) {
                return res.status(400).json({
                    success: false,
                    message: `Time conflict: you already have a reservation from ${existingStart.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} to ${existingEnd.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} on ${existingStart.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok' })}. Please choose a different time.`
                });
            }
        }

        // Set the user from auth token
        req.body.user = req.user.id;

        // Apply promotion code if provided (EPIC 4: US 4-1)
        const Promotion = require('../models/Promotion');
        if (req.body.promotionCode) {
            const promotion = await Promotion.findOne({
                code: req.body.promotionCode.toUpperCase().trim(),
                isActive: true
            });

            if (!promotion) {
                return res.status(400).json({ success: false, message: 'Invalid promotion code' });
            }

            if (promotion.expiresAt && new Date() > promotion.expiresAt) {
                return res.status(400).json({ success: false, message: 'This promotion code has expired' });
            }

            if (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit) {
                return res.status(400).json({ success: false, message: 'This promotion code has reached its usage limit' });
            }

            // Calculate discount
            const originalPrice = service.price;
            let discountAmount = 0;
            if (promotion.discountType === 'flat') {
                discountAmount = Math.min(promotion.discountValue, originalPrice);
            } else if (promotion.discountType === 'percentage') {
                discountAmount = Math.round((originalPrice * promotion.discountValue / 100) * 100) / 100;
                discountAmount = Math.min(discountAmount, originalPrice);
            }

            req.body.originalPrice = originalPrice;
            req.body.discountAmount = discountAmount;
            req.body.finalPrice = Math.max(0, originalPrice - discountAmount);
            req.body.promotionCode = promotion.code;

            // Increment usage count
            promotion.usedCount += 1;
            await promotion.save();
        } else {
            req.body.originalPrice = service.price;
            req.body.finalPrice = service.price;
            req.body.discountAmount = 0;
        }

        // Generate QR token for the reservation
        req.body.qrToken = crypto.randomBytes(16).toString('hex');
        req.body.qrActive = true;

        const reservation = await Reservation.create(req.body);

        // Send confirmation email with QR code (fire-and-forget)
        if (process.env.BREVO_API_KEY) {
            sendConfirmationEmail(reservation).catch(err =>
                console.error('[email] Failed to send confirmation:', err.message)
            );
        }

        res.status(201).json({
            success: true,
            message: `Reservation created successfully. You now have ${activeReservations + 1} of 3 active reservations.`,
            data: reservation
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update reservation
// @route   PUT /api/v1/reservations/:id
// @access  Private
exports.updateReservation = async (req, res, next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ success: false, message: `Reservation not found with id of ${req.params.id}` });
        }

        // Admin can edit any reservation
        // User can only edit their own and only if more than 1 day before reservation date
        if (req.user.role !== 'admin') {
            if (reservation.user.toString() !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Not authorized to update this reservation' });
            }

            // Check if reservation is at least 1 day away
            const now = new Date();
            const resvDate = new Date(reservation.resvDate);
            const oneDayBefore = new Date(resvDate);
            oneDayBefore.setDate(oneDayBefore.getDate() - 1);

            if (now > oneDayBefore) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'You can only edit reservations at least 1 day before the reservation date' 
                });
            }
        }

        reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        }).populate([
            { path: 'shop', select: 'name address location tel openTime closeTime' },
            { path: 'service', select: 'name area duration oil price sessions' },
            { path: 'user', select: 'name email telephone' }
        ]);

        // US 6-5: Send review request email when status changes to completed
        if (req.body.status === 'completed' && reservation.status === 'completed' && process.env.BREVO_API_KEY) {
            const { sendReviewRequestEmail } = require('../controllers/reservations');
            sendReviewRequestEmail(reservation).catch(err =>
                console.error('[email] Failed to send review request:', err.message)
            );
        }

        res.status(200).json({ success: true, data: reservation });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Cancel reservation (soft delete - update status to canceled)
// @route   DELETE /api/v1/reservations/:id
// @access  Private
exports.deleteReservation = async (req, res, next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ success: false, message: `Reservation not found with id of ${req.params.id}` });
        }

        // Admin can cancel any reservation
        // User can only cancel their own and only if more than 1 day before reservation date
        if (req.user.role !== 'admin') {
            if (reservation.user.toString() !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Not authorized to cancel this reservation' });
            }

            // Check if reservation is at least 1 day away
            const now = new Date();
            const resvDate = new Date(reservation.resvDate);
            const oneDayBefore = new Date(resvDate);
            oneDayBefore.setDate(oneDayBefore.getDate() - 1);

            if (now > oneDayBefore) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'You can only cancel reservations at least 1 day before the reservation date' 
                });
            }
        }

        // Soft delete: update status to cancelled instead of deleting
        reservation.status = 'cancelled';
        reservation.qrActive = false;
        await reservation.save();

        // Send cancellation email (fire-and-forget)
        if (process.env.BREVO_API_KEY) {
            sendCancellationEmail(reservation).catch(err =>
                console.error('[email] Failed to send cancellation:', err.message)
            );
        }

        res.status(200).json({ 
            success: true, 
            message: 'Reservation cancelled successfully. A cancellation confirmation has been sent to your email. Your QR code is now void.',
            data: reservation 
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
// @desc    Upload payment slip
// @route   POST /api/v1/reservations/:id/slip
// @access  Private
exports.uploadSlip = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ success: false, message: 'Reservation not found' });
        }

        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a file' });
        }

        reservation.slipImageUrl = `/uploads/slips/${req.file.filename}`;
        reservation.paymentStatus = 'waiting_verification';
        await reservation.save();

        const updated = await Reservation.findById(reservation._id).populate([
            { path: 'shop', select: 'name address location tel openTime closeTime' },
            { path: 'service', select: 'name area duration oil price sessions' },
            { path: 'user', select: 'name email telephone' }
        ]);

        res.status(200).json({ success: true, data: updated });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Verify payment slip (admin)
// @route   PUT /api/v1/reservations/:id/verify
// @access  Private/Admin
exports.verifySlip = async (req, res, next) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Action must be approve or reject' });
        }

        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ success: false, message: 'Reservation not found' });
        }

        if (reservation.paymentStatus !== 'waiting_verification') {
            return res.status(400).json({ success: false, message: 'Reservation is not waiting for verification' });
        }

        if (action === 'approve') {
            reservation.paymentStatus = 'approved';
            reservation.status = 'confirmed';
        } else {
            reservation.paymentStatus = 'rejected';
        }

        await reservation.save();

        const updated = await Reservation.findById(reservation._id).populate([
            { path: 'shop', select: 'name address location tel openTime closeTime' },
            { path: 'service', select: 'name area duration oil price sessions' },
            { path: 'user', select: 'name email telephone' }
        ]);

        res.status(200).json({ success: true, data: updated });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Verify QR code token
// @route   GET /api/v1/qr/verify/:token
// @access  Private/Admin
exports.verifyQR = async (req, res, next) => {
    try {
        const reservation = await Reservation.findOne({ qrToken: req.params.token })
            .populate([
                { path: 'shop', select: 'name address' },
                { path: 'service', select: 'name duration price' },
                { path: 'user', select: 'name email telephone' }
            ]);

        if (!reservation) {
            return res.status(404).json({ 
                success: false, 
                message: 'Invalid QR code — reservation not found' 
            });
        }

        // Check ownership: only the reservation owner or admin can view
        if (req.user.role !== 'admin' && reservation.user._id.toString() !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                message: 'Not authorized — this QR code belongs to another user' 
            });
        }

        if (!reservation.qrActive) {
            return res.status(400).json({ 
                success: false, 
                message: 'QR code is no longer valid' 
            });
        }

        if (reservation.status === 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'This reservation has been cancelled' 
            });
        }

        // Check if reservation date has passed (expired)
        const now = new Date();
        const resvDate = new Date(reservation.resvDate);
        const service = reservation.service;
        const durationMs = (service?.duration || 60) * 60 * 1000;
        const resvEnd = new Date(resvDate.getTime() + durationMs);

        if (now > resvEnd) {
            reservation.qrActive = false;
            await reservation.save();
            return res.status(400).json({ 
                success: false, 
                message: 'QR code is no longer valid — reservation date has passed' 
            });
        }

        res.status(200).json({
            success: true,
            reservationId: reservation._id,
            data: reservation,
            message: 'QR code verified successfully'
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// ---------------------------------------------------------------------------
// Email helpers (Brevo) — uses same BrevoClient as auth.js
// ---------------------------------------------------------------------------
const { BrevoClient } = require('@getbrevo/brevo');

async function getQRPageUrl(token) {
    return `${process.env.FRONTEND_URL || 'https://fe-project-68-addressme.vercel.app'}/qr/${token}`;
}

async function sendConfirmationEmail(reservation) {
    if (!reservation.populated?.('shop')) {
        await reservation.populate([
            { path: 'shop', select: 'name address' },
            { path: 'service', select: 'name duration price' },
            { path: 'user', select: 'name email' }
        ]);
    }
    const shop = reservation.shop;
    const service = reservation.service;
    const user = reservation.user;
    const date = new Date(reservation.resvDate).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const time = new Date(reservation.resvDate).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
    });

    const qrPageUrl = await getQRPageUrl(reservation.qrToken);

    const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
    await brevo.transactionalEmails.sendTransacEmail({
        to: [{ email: user.email, name: user.name }],
        sender: { email: process.env.BREVO_FROM_EMAIL, name: process.env.BREVO_FROM_NAME || 'Dungeon Inn' },
        subject: '🎉 Booking Confirmed — Dungeon Inn',
        htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Booking Confirmed</title></head>
<body style="margin:0;padding:0;background-color:#1A1A1A;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#2B2B2B;border:1px solid #403A36;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background-color:#2C1E18;padding:32px 40px;text-align:center;border-bottom:2px solid #E57A00;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#E57A00;letter-spacing:1px;">⚔️ DUNGEON INN</h1>
          <p style="margin:8px 0 0;font-size:13px;color:#8A8177;letter-spacing:2px;text-transform:uppercase;">Massage Reservation</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px 40px 32px;">
          <h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">Booking Confirmed! 🎉</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#A88C6B;line-height:1.6;">
            Greetings, <strong style="color:#D4CFC6;">${user.name}</strong>! Your reservation has been created.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;border-radius:8px;margin:16px 0;">
            <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;width:120px;">🏪 Shop</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${shop?.name || 'N/A'}</td></tr>
            <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;">💆 Service</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${service?.name || 'N/A'}</td></tr>
            <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;">📅 Date</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${date}</td></tr>
            <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;">🕐 Time</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${time}</td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center" style="padding:24px 0 8px;">
              <a href="${qrPageUrl}"
                 style="display:inline-block;padding:14px 36px;background-color:#E57A00;color:#1A110A;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">
                📱 View QR Code
              </a>
            </td></tr>
          </table>
          <p style="margin:8px 0 0;font-size:13px;color:#8A8177;line-height:1.6;">
            Show the QR code at the shop to verify your booking.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background-color:#1A1A1A;padding:20px 40px;text-align:center;border-top:1px solid #403A36;">
          <p style="margin:0;font-size:12px;color:#5A544E;">
            © 2026 Dungeon Inn. All rights reserved. &nbsp;|&nbsp;
            <span style="color:#E57A00;">Happy adventuring!</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,

    });
    console.log(`[email] Confirmation sent to ${user.email}`);
}

async function sendCancellationEmail(reservation) {
    if (!reservation.populated?.('shop')) {
        await reservation.populate([
            { path: 'shop', select: 'name address' },
            { path: 'service', select: 'name duration price' },
            { path: 'user', select: 'name email' }
        ]);
    }
    const user = reservation.user;
    const shop = reservation.shop;
    const service = reservation.service;
    const date = new Date(reservation.resvDate).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
    await brevo.transactionalEmails.sendTransacEmail({
        to: [{ email: user.email, name: user.name }],
        sender: { email: process.env.BREVO_FROM_EMAIL, name: process.env.BREVO_FROM_NAME || 'Dungeon Inn' },
        subject: '❌ Booking Cancelled — Dungeon Inn',
        htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Booking Cancelled</title></head>
<body style="margin:0;padding:0;background-color:#1A1A1A;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#2B2B2B;border:1px solid #403A36;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#2C1E18;padding:32px 40px;text-align:center;border-bottom:2px solid #E57A00;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#E57A00;letter-spacing:1px;">⚔️ DUNGEON INN</h1>
          <p style="margin:8px 0 0;font-size:13px;color:#8A8177;letter-spacing:2px;text-transform:uppercase;">Massage Reservation</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">Booking Cancelled</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#A88C6B;line-height:1.6;">
            Hi <strong style="color:#D4CFC6;">${user.name}</strong>, your reservation has been cancelled.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;border-radius:8px;margin:16px 0;">
            <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;width:120px;">🏪 Shop</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${shop?.name || 'N/A'}</td></tr>
            <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;">💆 Service</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${service?.name || 'N/A'}</td></tr>
            <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;">📅 Date</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${date}</td></tr>
          </table>
          <div style="background-color:#3B1A1A;border:1px solid #7F1D1D;border-radius:8px;padding:16px;margin:24px 0;">
            <p style="margin:0;font-size:14px;color:#FCA5A5;line-height:1.6;">⛔ Your QR code is now <strong>void</strong> and cannot be used at the shop.</p>
          </div>
        </td></tr>
        <tr><td style="background-color:#1A1A1A;padding:20px 40px;text-align:center;border-top:1px solid #403A36;">
          <p style="margin:0;font-size:12px;color:#5A544E;">
            © 2026 Dungeon Inn. All rights reserved. &nbsp;|&nbsp;
            <span style="color:#E57A00;">Happy adventuring!</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    });
    console.log(`[email] Cancellation sent to ${user.email}`);
}

async function sendReviewRequestEmail(reservation) {
    if (!reservation.populated?.('shop')) {
        await reservation.populate([
            { path: 'shop', select: 'name' },
            { path: 'service', select: 'name' },
            { path: 'user', select: 'name email' }
        ]);
    }
    const user = reservation.user;
    const shop = reservation.shop;
    const reviewUrl = `${process.env.FRONTEND_URL || 'https://fe-project-68-addressme.vercel.app'}/mybookings`;

    const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
    await brevo.transactionalEmails.sendTransacEmail({
        to: [{ email: user.email, name: user.name }],
        sender: { email: process.env.BREVO_FROM_EMAIL, name: process.env.BREVO_FROM_NAME || 'Dungeon Inn' },
        subject: '⭐ How was your visit? — Dungeon Inn',
        htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Review Your Visit</title></head>
<body style="margin:0;padding:0;background-color:#1A1A1A;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#2B2B2B;border:1px solid #403A36;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#2C1E18;padding:32px 40px;text-align:center;border-bottom:2px solid #E57A00;">
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#E57A00;letter-spacing:1px;">⚔️ DUNGEON INN</h1>
          <p style="margin:8px 0 0;font-size:13px;color:#8A8177;letter-spacing:2px;text-transform:uppercase;">Massage Reservation</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">How was your visit? ⭐</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#A88C6B;line-height:1.6;">
            Hi <strong style="color:#D4CFC6;">${user.name}</strong>, your appointment at <strong style="color:#D4CFC6;">${shop?.name || 'the shop'}</strong> has been completed.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#A88C6B;line-height:1.6;">
            We'd love to hear your feedback! Leave a review to help others find great massage services.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center" style="padding:8px 0 32px;">
              <a href="${reviewUrl}" style="display:inline-block;padding:14px 36px;background-color:#E57A00;color:#1A110A;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">
                ⭐ Leave a Review
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#1A1A1A;padding:20px 40px;text-align:center;border-top:1px solid #403A36;">
          <p style="margin:0;font-size:12px;color:#5A544E;">
            © 2026 Dungeon Inn. All rights reserved. &nbsp;|&nbsp;
            <span style="color:#E57A00;">Happy adventuring!</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    });
    console.log(`[email] Review request sent to ${user.email}`);
}

module.exports = exports;
module.exports.sendReviewRequestEmail = sendReviewRequestEmail;
