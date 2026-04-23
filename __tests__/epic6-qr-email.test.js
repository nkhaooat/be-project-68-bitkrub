const Reservation = require('../models/Reservation');
const mongoose = require('mongoose');

// Mock models
jest.mock('../models/Reservation');
jest.mock('../models/MassageShop');
jest.mock('../models/MassageService');
jest.mock('../models/Promotion');
jest.mock('sib-api-v3-sdk');

// Mock autoComplete
Reservation.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const { verifyQR } = require('../controllers/reservations');

// Helper: mock findOne with chained populate(array)
function mockFindOne(resolvedValue) {
  const populateFn = jest.fn().mockResolvedValue(resolvedValue);
  Reservation.findOne.mockReturnValue({ populate: populateFn });
  return populateFn;
}

describe('EPIC 6 — QR Code Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('US 6-1: GET /api/v1/qr/verify/:token', () => {
    test('Verify valid QR → success', async () => {
      const mockReservation = {
        _id: new mongoose.Types.ObjectId(),
        qrToken: 'validtoken123',
        qrActive: true,
        status: 'confirmed',
        resvDate: new Date(Date.now() + 86400000), // tomorrow
        shop: { name: 'Test Shop', address: '123 Test St' },
        service: { name: 'Test Service', duration: 60, price: 500 },
        user: { name: 'Test User', email: 'test@test.com', telephone: '0812345678' },
      };

      mockFindOne(mockReservation);

      const req = { params: { token: 'validtoken123' } };
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'QR code verified successfully'
        })
      );
    });

    test('Verify invalid token → 404', async () => {
      mockFindOne(null);

      const req = { params: { token: 'invalidtoken' } };
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Invalid QR code')
        })
      );
    });

    test('Verify cancelled reservation QR → failure', async () => {
      const mockReservation = {
        _id: new mongoose.Types.ObjectId(),
        qrToken: 'cancelledtoken',
        qrActive: true,
        status: 'cancelled',
        resvDate: new Date(Date.now() + 86400000),
        shop: { name: 'Test Shop' },
        service: { name: 'Test Service', duration: 60 },
        user: { name: 'Test User' },
      };

      mockFindOne(mockReservation);

      const req = { params: { token: 'cancelledtoken' } };
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('cancelled')
        })
      );
    });

    test('Verify expired QR (qrActive=false) → failure', async () => {
      const mockReservation = {
        _id: new mongoose.Types.ObjectId(),
        qrToken: 'expiredtoken',
        qrActive: false,
        status: 'confirmed',
        resvDate: new Date(Date.now() + 86400000),
        shop: { name: 'Test Shop' },
        service: { name: 'Test Service', duration: 60 },
        user: { name: 'Test User' },
      };

      mockFindOne(mockReservation);

      const req = { params: { token: 'expiredtoken' } };
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('no longer valid')
        })
      );
    });

    test('Verify QR for past-date reservation → void and failure', async () => {
      const pastDate = new Date(Date.now() - 7200000); // 2 hours ago
      const mockReservation = {
        _id: new mongoose.Types.ObjectId(),
        qrToken: 'pasttoken',
        qrActive: true,
        status: 'confirmed',
        resvDate: pastDate,
        shop: { name: 'Test Shop' },
        service: { name: 'Test Service', duration: 60 },
        user: { name: 'Test User' },
        save: jest.fn().mockResolvedValue(true),
      };

      mockFindOne(mockReservation);

      const req = { params: { token: 'pasttoken' } };
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(mockReservation.qrActive).toBe(false);
      expect(mockReservation.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
