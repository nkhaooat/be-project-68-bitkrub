const MassageShop = require('../models/MassageShop');
const Review = require('../models/Review');
const { getPlacePhotoBuffer, getFallbackPhotoUrl } = require('../utils/google/places');

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
            .limit(limit)
            .lean();

        const pages = Math.ceil(total / limit);

        // Add photo proxy URL and Google photo availability flag
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        // Get platform review stats for all shops in this page
        const shopIds = shops.map(s => s._id);
        const reviewStats = await Review.aggregate([
            { $match: { shop: { $in: shopIds } } },
            { $group: { _id: '$shop', avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
        ]);
        const reviewStatsMap = new Map(reviewStats.map(s => [s._id.toString(), s]));

        const data = shops.map(s => ({
            ...s,
            photoProxy: `${baseUrl}/api/v1/shops/${s._id}/photo?fallback=1`,
            hasGooglePhoto: !!s.placeId,  // EPIC 3: indicate if Google photo is available
            platformRating: reviewStatsMap.has(s._id.toString()) ? Math.round(reviewStatsMap.get(s._id.toString()).avgRating * 10) / 10 : 0,
            platformReviewCount: reviewStatsMap.has(s._id.toString()) ? reviewStatsMap.get(s._id.toString()).reviewCount : 0,
        }));

        res.status(200).json({
            success: true,
            count: data.length,
            pagination: {
                total,
                page,
                pages,
                limit
            },
            data
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
        const shop = await MassageShop.findById(req.params.id).populate('services').lean();
        if (!shop) {
            return res.status(404).json({ success: false, message: `Shop not found with id of ${req.params.id}` });
        }
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        shop.photoProxy = `${baseUrl}/api/v1/shops/${shop._id}/photo?fallback=1`;
        shop.hasGooglePhoto = !!shop.placeId;  // EPIC 3: indicate if Google photo is available
        res.status(200).json({ success: true, data: shop });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Proxy a shop photo from Google Places API to avoid exposing API key
//          EPIC 3: Google Place v1 API with MongoDB fallback
// @route   GET /api/v1/shops/:id/photo
// @access  Public
exports.getShopPhoto = async (req, res, next) => {
    try {
        const shop = await MassageShop.findById(req.params.id).lean();
        if (!shop) {
            return res.status(404).json({ success: false, message: `Shop not found with id of ${req.params.id}` });
        }

        const fallback = typeof req.query.fallback === 'string' ? req.query.fallback === '1' : true;

        // EPIC 3: Try Google Places API first (modularized)
        if (shop.placeId) {
            const result = await getPlacePhotoBuffer({ placeId: shop.placeId });
            if (result) {
                res.set('Content-Type', result.contentType);
                res.set('Cache-Control', 'public, max-age=86400'); // 1 day
                return res.send(result.buffer);
            }
        }

        // EPIC 3: Fallback to MongoDB photo (modularized)
        if (fallback) {
            const url = getFallbackPhotoUrl(shop);
            if (url) return res.redirect(url);
        }

        // Nothing available
        res.status(404).json({ success: false, message: 'No photo available' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
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

// @desc    Add TikTok links to a shop
// @route   POST /api/v1/shops/:id/tiktok
// @access  Private/Admin
exports.addTiktokLinks = async (req, res, next) => {
    try {
        const { links } = req.body; // links: string[]
        if (!links || !Array.isArray(links) || links.length === 0) {
            return res.status(400).json({ success: false, message: 'links array is required' });
        }
        // Validate TikTok URLs
        const validLinks = links.filter(l => typeof l === 'string' && l.includes('tiktok.com'));
        if (validLinks.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid TikTok URLs provided' });
        }
        const shop = await MassageShop.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { tiktokLinks: { $each: validLinks } } },
            { new: true }
        );
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
        res.status(200).json({ success: true, data: shop.tiktokLinks });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update (replace) TikTok links for a shop
// @route   PUT /api/v1/shops/:id/tiktok
// @access  Private/Admin
exports.updateTiktokLinks = async (req, res, next) => {
    try {
        const { links } = req.body; // links: string[]
        if (!Array.isArray(links)) {
            return res.status(400).json({ success: false, message: 'links array is required' });
        }
        const validLinks = links.filter(l => typeof l === 'string' && l.includes('tiktok.com'));
        const shop = await MassageShop.findByIdAndUpdate(
            req.params.id,
            { $set: { tiktokLinks: validLinks } },
            { new: true }
        );
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
        res.status(200).json({ success: true, data: shop.tiktokLinks });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Remove a specific TikTok link from a shop
// @route   DELETE /api/v1/shops/:id/tiktok
// @access  Private/Admin
exports.removeTiktokLink = async (req, res, next) => {
    try {
        const { link } = req.body; // link: string (single URL to remove)
        if (!link) {
            return res.status(400).json({ success: false, message: 'link is required' });
        }
        const shop = await MassageShop.findByIdAndUpdate(
            req.params.id,
            { $pull: { tiktokLinks: link } },
            { new: true }
        );
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
        res.status(200).json({ success: true, data: shop.tiktokLinks });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update shop description
// @route   PUT /api/v1/shops/:id/description
// @access  Private/Admin
exports.updateDescription = async (req, res, next) => {
    try {
        const { description } = req.body;
        if (typeof description !== 'string') {
            return res.status(400).json({ success: false, message: 'description string is required' });
        }
        const shop = await MassageShop.findByIdAndUpdate(
            req.params.id,
            { $set: { description: description.trim() || null } },
            { new: true }
        );
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
        res.status(200).json({ success: true, data: { description: shop.description } });
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