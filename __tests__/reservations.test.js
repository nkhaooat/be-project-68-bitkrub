'use strict';

// ─── Mock Models ─────────────────────────────────────────────────────────────
jest.mock('../models/Reservation');
jest.mock('../models/MassageShop');
jest.mock('../models/MassageService');

const Reservation   = require('../models/Reservation');
const MassageShop   = require('../models/MassageShop');
const MassageService = require('../models/MassageService');
const { createReservation } = require('../utils/createReservation');

// Helper to build mock req/res
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

const SHOP_ID    = '663000000000000000000001';
const SERVICE_ID = '663000000000000000000002';
const USER_ID    = '663000000000000000000003';

beforeEach(() => jest.clearAllMocks());

// ─── createReservation ────────────────────────────────────────────────────────
describe('createReservation', () => {

  it('TC-R1: rejects when user already has 3 active reservations', async () => {
    Reservation.countDocuments = jest.fn().mockResolvedValue(3);

    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: new Date() },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('TC-R2: rejects when shop does not exist', async () => {
    Reservation.countDocuments = jest.fn().mockResolvedValue(0);
    MassageShop.findById = jest.fn().mockResolvedValue(null);

    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: new Date() },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('TC-R3: rejects when service does not exist', async () => {
    Reservation.countDocuments = jest.fn().mockResolvedValue(0);
    MassageShop.findById = jest.fn().mockResolvedValue({ _id: SHOP_ID });
    MassageService.findById = jest.fn().mockResolvedValue(null);

    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: new Date() },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('TC-R4: rejects when service does not belong to the shop', async () => {
    Reservation.countDocuments = jest.fn().mockResolvedValue(0);
    MassageShop.findById = jest.fn().mockResolvedValue({ _id: SHOP_ID });
    MassageService.findById = jest.fn().mockResolvedValue({
      _id: SERVICE_ID,
      shop: { toString: () => 'differentShopId' },
    });

    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: new Date() },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('does not belong') })
    );
  });

  it('TC-R5: creates reservation successfully', async () => {
    const fakeReservation = { _id: 'resv1', shop: SHOP_ID, service: SERVICE_ID, user: USER_ID };
    Reservation.countDocuments = jest.fn().mockResolvedValue(1);
    Reservation.find = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });
    MassageShop.findById    = jest.fn().mockResolvedValue({ _id: SHOP_ID });
    MassageService.findById = jest.fn().mockResolvedValue({
      _id: SERVICE_ID,
      shop: { toString: () => SHOP_ID },
      duration: 60,
    });
    Reservation.create = jest.fn().mockResolvedValue(fakeReservation);

    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: new Date() },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: fakeReservation })
    );
  });

  it('TC-R6: handles unexpected database error', async () => {
    Reservation.countDocuments = jest.fn().mockRejectedValue(new Error('DB error'));

    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: new Date() },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'DB error' })
    );
  });

  // ─── Time-overlap constraint tests ─────────────────────────────────────────

  it('TC-R7: rejects when new reservation overlaps with existing (same time)', async () => {
    const existingStart = new Date('2026-03-28T12:00:00+07:00');
    const existingReservation = {
      _id: 'existing1',
      resvDate: existingStart,
      service: { duration: 60 },
    };

    Reservation.countDocuments = jest.fn().mockResolvedValue(1);
    Reservation.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([existingReservation])
    });
    MassageShop.findById = jest.fn().mockResolvedValue({ _id: SHOP_ID });
    MassageService.findById = jest.fn().mockResolvedValue({
      _id: SERVICE_ID,
      shop: { toString: () => SHOP_ID },
      duration: 60,
    });

    // Try to book at same time 12:00-13:00
    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: existingStart },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('Time conflict') })
    );
  });

  it('TC-R8: rejects when new reservation overlaps partially (starts during existing)', async () => {
    const existingStart = new Date('2026-03-28T12:00:00+07:00');
    const existingReservation = {
      _id: 'existing1',
      resvDate: existingStart,
      service: { duration: 60 }, // 12:00-13:00
    };

    Reservation.countDocuments = jest.fn().mockResolvedValue(1);
    Reservation.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([existingReservation])
    });
    MassageShop.findById = jest.fn().mockResolvedValue({ _id: SHOP_ID });
    MassageService.findById = jest.fn().mockResolvedValue({
      _id: SERVICE_ID,
      shop: { toString: () => SHOP_ID },
      duration: 60,
    });

    // Try to book at 12:30 (overlaps 12:00-13:00)
    const newStart = new Date('2026-03-28T12:30:00+07:00');
    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: newStart },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('Time conflict') })
    );
  });

  it('TC-R9: rejects when new reservation overlaps partially (ends during existing)', async () => {
    const existingStart = new Date('2026-03-28T13:00:00+07:00');
    const existingReservation = {
      _id: 'existing1',
      resvDate: existingStart,
      service: { duration: 60 }, // 13:00-14:00
    };

    Reservation.countDocuments = jest.fn().mockResolvedValue(1);
    Reservation.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([existingReservation])
    });
    MassageShop.findById = jest.fn().mockResolvedValue({ _id: SHOP_ID });
    MassageService.findById = jest.fn().mockResolvedValue({
      _id: SERVICE_ID,
      shop: { toString: () => SHOP_ID },
      duration: 90, // 12:30-14:00 overlaps 13:00-14:00
    });

    const newStart = new Date('2026-03-28T12:30:00+07:00');
    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: newStart },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('Time conflict') })
    );
  });

  it('TC-R10: allows non-overlapping reservations (back-to-back is OK)', async () => {
    const existingStart = new Date('2026-03-28T12:00:00+07:00');
    const existingReservation = {
      _id: 'existing1',
      resvDate: existingStart,
      service: { duration: 60 }, // 12:00-13:00
    };

    Reservation.countDocuments = jest.fn().mockResolvedValue(1);
    Reservation.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([existingReservation])
    });
    MassageShop.findById = jest.fn().mockResolvedValue({ _id: SHOP_ID });
    MassageService.findById = jest.fn().mockResolvedValue({
      _id: SERVICE_ID,
      shop: { toString: () => SHOP_ID },
      duration: 60,
    });

    const fakeReservation = { _id: 'resv2', shop: SHOP_ID, service: SERVICE_ID, user: USER_ID };
    Reservation.create = jest.fn().mockResolvedValue(fakeReservation);

    // Book at exactly 13:00 (back-to-back, no overlap)
    const newStart = new Date('2026-03-28T13:00:00+07:00');
    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: newStart },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('TC-R11: allows non-overlapping reservations (gap between)', async () => {
    const existingStart = new Date('2026-03-28T12:00:00+07:00');
    const existingReservation = {
      _id: 'existing1',
      resvDate: existingStart,
      service: { duration: 60 }, // 12:00-13:00
    };

    Reservation.countDocuments = jest.fn().mockResolvedValue(1);
    Reservation.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue([existingReservation])
    });
    MassageShop.findById = jest.fn().mockResolvedValue({ _id: SHOP_ID });
    MassageService.findById = jest.fn().mockResolvedValue({
      _id: SERVICE_ID,
      shop: { toString: () => SHOP_ID },
      duration: 60,
    });

    const fakeReservation = { _id: 'resv2', shop: SHOP_ID, service: SERVICE_ID, user: USER_ID };
    Reservation.create = jest.fn().mockResolvedValue(fakeReservation);

    // Book at 14:00 (1 hour gap)
    const newStart = new Date('2026-03-28T14:00:00+07:00');
    const req = {
      user: { id: USER_ID, role: 'user' },
      body: { shop: SHOP_ID, service: SERVICE_ID, resvDate: newStart },
    };
    const res = mockRes();

    await createReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });
});
