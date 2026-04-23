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
// Email helpers (Brevo)
// ---------------------------------------------------------------------------
const Sib = require('sib-api-v3-sdk');
const QRCode = require('qrcode');

function getBrevoClient() {
    const defaultClient = Sib.ApiClient.instance;
    defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
    return new Sib.TransactionalEmailsApi();
}

async function generateQRBuffer(token) {
    const verifyUrl = `${process.env.FRONTEND_URL || 'https://fe-project-68-addressme.vercel.app'}/api/v1/qr/verify/${token}`;
    return await QRCode.toBuffer(verifyUrl, { type: 'png', width: 200, margin: 1 });
}

async function sendBrevoEmail(to, subject, htmlContent, inlineImage) {
    const Sib = require('sib-api-v3-sdk');
    const defaultClient = Sib.ApiClient.instance;
    defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
    const api = new Sib.TransactionalEmailsApi();

    const sendSmtpEmail = new Sib.SendSmtpEmail();
    sendSmtpEmail.sender = { name: process.env.BREVO_FROM_NAME || 'Dungeon Inn', email: process.env.BREVO_FROM_EMAIL || 'noreply@dungeoninn.com' };
    sendSmtpEmail.to = to;
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    if (inlineImage) {
        sendSmtpEmail.attachment = [inlineImage];
    }

    await api.sendTransacEmail(sendSmtpEmail);
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

    const qrBuffer = await generateQRBuffer(reservation.qrToken);
    const qrBase64 = qrBuffer.toString('base64');

    // Use Brevo REST API directly for inline image support
    const fetch = require('node-fetch');
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.BREVO_API_KEY
        },
        body: JSON.stringify({
            sender: { name: process.env.BREVO_FROM_NAME || 'Dungeon Inn', email: process.env.BREVO_FROM_EMAIL },
            to: [{ email: user.email, name: user.name }],
            subject: 'Booking Confirmed — Dungeon Inn',
            htmlContent: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #E57A00;">Dungeon Inn — Booking Confirmed</h2>
                <p>Hi ${user.name},</p>
                <p>Your reservation has been created successfully!</p>
                <table style="border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 8px; font-weight: bold;">Shop:</td><td style="padding: 8px;">${shop?.name || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Service:</td><td style="padding: 8px;">${service?.name || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${date}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">Time:</td><td style="padding: 8px;">${time}</td></tr>
                </table>
                <p>Show this QR code at the shop:</p>
                <img src="cid:qrcode" alt="QR Code" style="width: 200px; height: 200px;" />
                <p style="color: #888; font-size: 12px; margin-top: 20px;">Dungeon Inn — Massage Booking Platform</p>
            </div>`,
            attachment: [{
                name: 'qrcode.png',
                content: qrBase64,
                contentType: 'image/png',
                contentId: 'qrcode'
            }]
        })
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Brevo API ${resp.status}: ${err}`);
    }
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

    const api = getBrevoClient();
    const sendSmtpEmail = new Sib.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'Dungeon Inn', email: process.env.BREVO_FROM_EMAIL || 'noreply@dungeoninn.com' };
    sendSmtpEmail.to = [{ email: user.email, name: user.name }];
    sendSmtpEmail.subject = 'Booking Cancelled — Dungeon Inn';
    sendSmtpEmail.htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #E57A00;">Dungeon Inn — Booking Cancelled</h2>
            <p>Hi ${user.name},</p>
            <p>Your reservation has been cancelled.</p>
            <table style="border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; font-weight: bold;">Shop:</td><td style="padding: 8px;">${shop?.name || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Service:</td><td style="padding: 8px;">${service?.name || 'N/A'}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${date}</td></tr>
            </table>
            <p>Your QR code is now void and cannot be used.</p>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">Dungeon Inn — Massage Booking Platform</p>
        </div>
    `;

    await api.sendTransacEmail(sendSmtpEmail);
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

    const api = getBrevoClient();
    const sendSmtpEmail = new Sib.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'Dungeon Inn', email: process.env.BREVO_FROM_EMAIL || 'noreply@dungeoninn.com' };
    sendSmtpEmail.to = [{ email: user.email, name: user.name }];
    sendSmtpEmail.subject = 'How was your visit? — Dungeon Inn';
    sendSmtpEmail.htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #E57A00;">Dungeon Inn — How was your visit?</h2>
            <p>Hi ${user.name},</p>
            <p>Your appointment at <strong>${shop?.name || 'the shop'}</strong> has been completed.</p>
            <p>We'd love to hear your feedback! Leave a review to help others find great massage services.</p>
            <a href="${reviewUrl}" style="display: inline-block; background: #E57A00; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Leave a Review</a>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">Dungeon Inn — Massage Booking Platform</p>
        </div>
    `;

    await api.sendTransacEmail(sendSmtpEmail);
    console.log(`[email] Review request sent to ${user.email}`);
}

module.exports = exports;
module.exports.sendReviewRequestEmail = sendReviewRequestEmail;
