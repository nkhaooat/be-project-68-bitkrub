const MassageShop = require('../models/MassageShop');

// @desc    Get all massage shops
// @route   GET /api/v1/shops
// @access  Public
exports.getShops = async (req, res, next) => {
    try {
        let query = {};
        let sortQuery = {};

        // Search by name
        if (req.query.search) {
            query.name = { $regex: req.query.search, $options: 'i' };
        }

        // Filter by search area
        if (req.query.searchArea) {
            query.searchArea = req.query.searchArea;
        }

        // Filter by minimum rating
        if (req.query.minRating) {
            query.rating = { $gte: parseFloat(req.query.minRating) };
        }

        // Filter by price range
        if (req.query.minPrice || req.query.maxPrice) {
            query.priceRangeMin = {};
            if (req.query.minPrice) query.priceRangeMin.$gte = parseInt(req.query.minPrice);
            if (req.query.maxPrice) query.priceRangeMin.$lte = parseInt(req.query.maxPrice);
        }

        // Sorting
        const sortBy = req.query.sortBy || 'rating';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        
        if (sortBy === 'price') {
            sortQuery.priceRangeMin = sortOrder;
        } else if (sortBy === 'name') {
            sortQuery.name = sortOrder;
        } else {
            sortQuery.rating = sortOrder;
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 12;
        const startIndex = (page - 1) * limit;
        const total = await MassageShop.countDocuments(query);

        const shops = await MassageShop.find(query)
            .sort(sortQuery)
            .skip(startIndex)
            .limit(limit);

        const pages = Math.ceil(total / limit);

        res.status(200).json({
            success: true,
            count: shops.length,
            pagination: {
                total,
                page,
                pages,
                limit
            },
            data: shops
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get all shop areas
// @route   GET /api/v1/shops/areas
// @access  Public
exports.getShopAreas = async (req, res, next) => {
    try {
        const areas = await MassageShop.distinct('searchArea');
        res.status(200).json({
            success: true,
            count: areas.length,
            data: areas.filter(area => area) // Remove null/undefined
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get single massage shop
// @route   GET /api/v1/shops/:id
// @access  Public
exports.getShop = async (req, res, next) => {
    try {
        const shop = await MassageShop.findById(req.params.id).populate('services');
        if (!shop) {
            return res.status(404).json({ success: false, message: `Shop not found with id of ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: shop });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Create new massage shop
// @route   POST /api/v1/shops
// @access  Private/Admin
exports.createShop = async (req, res, next) => {
    try {
        const shop = await MassageShop.create(req.body);
        res.status(201).json({ success: true, data: shop });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update massage shop
// @route   PUT /api/v1/shops/:id
// @access  Private/Admin
exports.updateShop = async (req, res, next) => {
    try {
        const shop = await MassageShop.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!shop) {
            return res.status(404).json({ success: false, message: `Shop not found with id of ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: shop });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete massage shop
// @route   DELETE /api/v1/shops/:id
// @access  Private/Admin
exports.deleteShop = async (req, res, next) => {
    try {
        const shop = await MassageShop.findById(req.params.id);
        if (!shop) {
            return res.status(404).json({ success: false, message: `Shop not found with id of ${req.params.id}` });
        }
        await shop.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};