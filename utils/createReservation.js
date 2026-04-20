'use strict';

const Reservation    = require('../models/Reservation');
const MassageShop    = require('../models/MassageShop');
const MassageService = require('../models/MassageService');

/**
 * Create a new reservation.
 * Rules:
 *  - max 3 active reservations per user
 *  - shop must exist
 *  - service must exist and belong to the shop
 *
 * @route  POST /api/v1/reservations
 * @access Private
 */
async function createReservation(req, res) {
  try {
    // Check active reservation limit
    const activeReservations = await Reservation.countDocuments({
      user: req.user.id,
      status: { $in: ['pending', 'confirmed'] },
      resvDate: { $gte: new Date() },
    });

    if (activeReservations >= 3) {
      return res.status(400).json({
        success: false,
        message: 'You can only have up to 3 active reservations. Please cancel an existing reservation first.',
      });
    }

    // Validate shop
    const shop = await MassageShop.findById(req.body.shop);
    if (!shop) {
      return res.status(404).json({ success: false, message: `Shop not found with id of ${req.body.shop}` });
    }

    // Validate service
    const service = await MassageService.findById(req.body.service);
    if (!service) {
      return res.status(404).json({ success: false, message: `Service not found with id of ${req.body.service}` });
    }
    if (service.shop.toString() !== req.body.shop) {
      return res.status(400).json({ success: false, message: 'Service does not belong to the selected shop' });
    }

    // Check for time-overlap with existing active reservations
    const newStart = new Date(req.body.resvDate);
    const newEnd = new Date(newStart.getTime() + service.duration * 60 * 1000);

    const existingReservations = await Reservation.find({
      user: req.user.id,
      status: { $in: ['pending', 'confirmed'] },
    }).populate('service', 'duration');

    for (const existing of existingReservations) {
      const existingStart = new Date(existing.resvDate);
      const existingDuration = existing.service?.duration || 60;
      const existingEnd = new Date(existingStart.getTime() + existingDuration * 60 * 1000);

      if (newStart < existingEnd && newEnd > existingStart) {
        return res.status(400).json({
          success: false,
          message: `Time conflict: you already have a reservation from ${existingStart.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} to ${existingEnd.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} on ${existingStart.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok' })}. Please choose a different time.`,
        });
      }
    }

    req.body.user = req.user.id;
    const reservation = await Reservation.create(req.body);

    return res.status(201).json({
      success: true,
      message: `Reservation created successfully. You now have ${activeReservations + 1} of 3 active reservations.`,
      data: reservation,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = { createReservation };
