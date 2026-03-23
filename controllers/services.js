const MassageService = require('../models/MassageService');
const MassageShop = require('../models/MassageShop');

// @desc    Get all massage services
// @route   GET /api/v1/services
// @route   GET /api/v1/shops/:shopId/services
// @access  Public
exports.getServices = async (req, res, next) => {
    try {
        let query;
        let mongoQuery = {};
        
        if (req.params.shopId) {
            mongoQuery = { shop: req.params.shopId };
            query = MassageService.find(mongoQuery).populate({
                path: 'shop',
                select: 'name address location tel'
            });
        } else {
            let reqQuery = { ...req.query };
            const removeFields = ['select', 'sort', 'page', 'limit', 'search'];
            removeFields.forEach(param => delete reqQuery[param]);

            let queryStr = JSON.stringify(reqQuery);
            queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
            
            // Build base query
            mongoQuery = JSON.parse(queryStr);
            
            // Add text search if provided
            if (req.query.search) {
                mongoQuery.name = { $regex: req.query.search, $options: 'i' };
            }
            
            // Add shop filter if provided
            if (req.query.shop) {
                mongoQuery.shop = req.query.shop;
            }
            
            query = MassageService.find(mongoQuery).populate({
                path: 'shop',
                select: 'name address location tel'
            });
        }

        if (req.query.select) {
            const fields = req.query.select.split(',').join(' ');
            query = query.select(fields);
        }

        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-createdAt');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const startIndex = (page - 1) * limit;
        
        // Get filtered count for pagination
        const total = await MassageService.countDocuments(mongoQuery);
        const pages = Math.ceil(total / limit);

        query = query.skip(startIndex).limit(limit);

        const services = await query;

        res.status(200).json({
            success: true,
            count: services.length,
            pagination: {
                total,
                page,
                pages,
                limit
            },
            data: services
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get single massage service
// @route   GET /api/v1/services/:id
// @access  Public
exports.getService = async (req, res, next) => {
    try {
        const service = await MassageService.findById(req.params.id).populate({
            path: 'shop',
            select: 'name address location tel openTime closeTime'
        });
        if (!service) {
            return res.status(404).json({ success: false, message: `Service not found with id of ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: service });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Create new massage service
// @route   POST /api/v1/shops/:shopId/services
// @access  Private/Admin
exports.createService = async (req, res, next) => {
    try {
        req.body.shop = req.params.shopId;
        const shop = await MassageShop.findById(req.params.shopId);
        if (!shop) {
            return res.status(404).json({ success: false, message: `Shop not found with id of ${req.params.shopId}` });
        }
        const service = await MassageService.create(req.body);
        res.status(201).json({ success: true, data: service });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update massage service
// @route   PUT /api/v1/services/:id
// @access  Private/Admin
exports.updateService = async (req, res, next) => {
    try {
        const service = await MassageService.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!service) {
            return res.status(404).json({ success: false, message: `Service not found with id of ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: service });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete massage service
// @route   DELETE /api/v1/services/:id
// @access  Private/Admin
exports.deleteService = async (req, res, next) => {
    try {
        const service = await MassageService.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ success: false, message: `Service not found with id of ${req.params.id}` });
        }
        await service.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};