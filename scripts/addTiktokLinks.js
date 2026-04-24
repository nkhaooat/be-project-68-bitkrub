'use strict';

const MassageShop = require('../models/MassageShop');

/**
 * Add TikTok links to a shop (deduplicates via $addToSet).
 * Rules:
 *  - links must be a non-empty array
 *  - each link must be a string containing 'tiktok.com'
 *  - shop must exist
 *
 * @route  POST /api/v1/shops/:id/tiktok
 * @access Private/Admin
 */
async function addTiktokLinks(req, res) {
  try {
    const { links } = req.body;

    if (!links || !Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ success: false, message: 'links array is required' });
    }

    const validLinks = links.filter(l => typeof l === 'string' && l.includes('tiktok.com'));

    if (validLinks.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid TikTok URLs provided' });
    }

    const shop = await MassageShop.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { tiktokLinks: { $each: validLinks } } },
      { new: true }
    );

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    return res.status(200).json({ success: true, data: shop.tiktokLinks });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = { addTiktokLinks };
