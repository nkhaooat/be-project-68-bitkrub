const Reservation = require('../models/Reservation');
const mongoose = require('mongoose');

jest.mock('../models/Reservation');
jest.mock('../models/MassageShop');
jest.mock('../models/MassageService');
jest.mock('../models/Promotion');
jest.mock('@getbrevo/brevo');
jest.mock('../services/email', () => ({
  sendConfirmationEmail: jest.fn(),
  sendCancellationEmail: jest.fn(),
  sendReviewRequestEmail: jest.fn(),
}));

Reservation.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const { verifyQR } = require('../controllers/reservations');

function mockFindOne(resolvedValue) {
  const populateFn = jest.fn().mockResolvedValue(resolvedValue);
  Reservation.findOne.mockReturnValue({ populate: populateFn });
  return populateFn;
}

const mockReq = (token, userId = 'owner123', role = 'user') => ({
  params: { token },
  user: { id: userId, role }
});

describe('EPIC 6 — QR Code Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('US 6-1: GET /api/v1/qr/verify/:token', () => {
    test('Verify valid QR → success (owner)', async () => {
      const mockReservation = {
        _id: new mongoose.Types.ObjectId(),
        qrToken: 'validtoken123',
        qrActive: true,
        status: 'confirmed',
        resvDate: new Date(Date.now() + 86400000),
        shop: { name: 'Test Shop', address: '123 Test St' },
        service: { name: 'Test Service', duration: 60, price: 500 },
        user: { _id: 'owner123', name: 'Test User', email: 'test@test.com', telephone: '0812345678' },
      };

      mockFindOne(mockReservation);

      const req = mockReq('validtoken123', 'owner123');
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

    test('Verify valid QR → success (admin)', async () => {
      const mockReservation = {
        _id: new mongoose.Types.ObjectId(),
        qrToken: 'validtoken123',
        qrActive: true,
        status: 'confirmed',
        resvDate: new Date(Date.now() + 86400000),
        shop: { name: 'Test Shop', address: '123 Test St' },
        service: { name: 'Test Service', duration: 60, price: 500 },
        user: { _id: 'owner456', name: 'Test User', email: 'test@test.com', telephone: '0812345678' },
      };

      mockFindOne(mockReservation);

      const req = mockReq('validtoken123', 'admin789', 'admin');
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('Verify invalid token → 404', async () => {
      mockFindOne(null);

      const req = mockReq('invalidtoken');
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('Verify with wrong user → 403', async () => {
      const mockReservation = {
        _id: new mongoose.Types.ObjectId(),
        qrToken: 'someToken',
        qrActive: true,
        status: 'confirmed',
        resvDate: new Date(Date.now() + 86400000),
        shop: { name: 'Test Shop' },
        service: { name: 'Test Service', duration: 60 },
        user: { _id: 'owner456', name: 'Other User' },
      };

      mockFindOne(mockReservation);

      const req = mockReq('someToken', 'wrongUser', 'user');
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Not authorized')
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
        user: { _id: 'owner123', name: 'Test User' },
      };

      mockFindOne(mockReservation);

      const req = mockReq('cancelledtoken', 'owner123');
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
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
        user: { _id: 'owner123', name: 'Test User' },
      };

      mockFindOne(mockReservation);

      const req = mockReq('expiredtoken', 'owner123');
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('no longer valid')
        })
      );
    });

    test('Verify QR for past-date reservation → void and failure', async () => {
      const pastDate = new Date(Date.now() - 7200000);
      const mockReservation = {
        _id: new mongoose.Types.ObjectId(),
        qrToken: 'pasttoken',
        qrActive: true,
        status: 'confirmed',
        resvDate: pastDate,
        shop: { name: 'Test Shop' },
        service: { name: 'Test Service', duration: 60 },
        user: { _id: 'owner123', name: 'Test User' },
        save: jest.fn().mockResolvedValue(true),
      };

      mockFindOne(mockReservation);

      const req = mockReq('pasttoken', 'owner123');
      const res = mockRes();

      await verifyQR(req, res, jest.fn());

      expect(mockReservation.qrActive).toBe(false);
      expect(mockReservation.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
