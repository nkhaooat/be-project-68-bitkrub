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
    MassageShop.findById    = jest.fn().mockResolvedValue({ _id: SHOP_ID });
    MassageService.findById = jest.fn().mockResolvedValue({
      _id: SERVICE_ID,
      shop: { toString: () => SHOP_ID },
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
});
