const Reservation = require('../models/Reservation');
const MassageShop = require('../models/MassageShop');
const MassageService = require('../models/MassageService');

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

        const reservation = await Reservation.create(req.body);

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
        await reservation.save();

        res.status(200).json({ 
            success: true, 
            message: 'Reservation cancelled successfully',
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
