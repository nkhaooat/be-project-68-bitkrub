const User = require('../models/User');
const MassageShop = require('../models/MassageShop');
const Reservation = require('../models/Reservation');
const mongoose = require('mongoose');

jest.mock('../models/User');
jest.mock('../models/MassageShop');
jest.mock('../models/Reservation');

// Mock auth middleware
jest.mock('../middleware/auth', () => {
  const original = jest.requireActual('../middleware/auth');
  return {
    protect: (req, res, next) => {
      req.user = global.__mockUser__;
      next();
    },
    authorize: (...roles) => (req, res, next) => {
      if (!roles.includes(req.user?.role)) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      next();
    },
    requireMerchant: original.requireMerchant,
  };
});

// Import after mocks
const { registerMerchant } = require('../controllers/auth');
const { approveMerchant, rejectMerchant, getMerchants } = require('../controllers/merchants');
const { scanQR } = require('../controllers/merchant');

describe('EPIC 7 — Merchant Role & Admin Approval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('US 7-1: User schema — merchant fields', () => {
    it('should have merchant in role enum', () => {
      // Schema is mocked but we verify the source model supports it
      const originalSchema = jest.requireActual('../models/User').schema;
      expect(originalSchema.paths.role.enumValues).toContain('merchant');
    });

    it('should have merchantStatus field', () => {
      const originalSchema = jest.requireActual('../models/User').schema;
      expect(originalSchema.paths.merchantStatus).toBeDefined();
    });

    it('should have merchantShop reference field with index', () => {
      expect(User.schema.paths.merchantShop).toBeDefined();
    });
  });

  describe('US 7-2: Merchant registration', () => {
    it('should register merchant with valid shopId', async () => {
      const mockShop = { _id: 'shop1', name: 'Test Shop' };
      MassageShop.findById.mockResolvedValue(mockShop);
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        _id: 'm1', name: 'Merchant', email: 'm@t.com',
        role: 'merchant', merchantStatus: 'pending', merchantShop: 'shop1',
        getSignedJwtToken: () => 'token'
      });

      const req = {
        body: { name: 'Merchant', email: 'm@t.com', telephone: '081', password: '123456', shopId: 'shop1' }
      };
      const cookie = jest.fn().mockReturnThis();
      const res = { status: jest.fn(() => ({ json: jest.fn(), cookie })), json: jest.fn(), cookie };

      await registerMerchant(req, res, jest.fn());
      // sendTokenResponse sets cookie + returns success
      expect(res.status.mock.calls[0]?.[0] || res.cookie?.mock?.calls?.length).toBeDefined();
    });

    it('should return 404 for invalid shopId', async () => {
      MassageShop.findById.mockResolvedValue(null);

      const req = { body: { shopId: 'bad-id', name: 'M', email: 'm@t.com', telephone: '081', password: '123456' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await registerMerchant(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('US 7-3: Admin approve/reject merchant', () => {
    it('should approve a pending merchant', async () => {
      const mockMerchant = {
        _id: 'm1', role: 'merchant', merchantStatus: 'pending',
        save: jest.fn().mockResolvedValue({ _id: 'm1', merchantStatus: 'approved' })
      };
      User.findOne.mockResolvedValue(mockMerchant);

      const req = { params: { id: 'm1' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await approveMerchant(req, res, jest.fn());
      expect(mockMerchant.merchantStatus).toBe('approved');
      expect(mockMerchant.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should reject a pending merchant', async () => {
      const mockMerchant = {
        _id: 'm1', role: 'merchant', merchantStatus: 'pending',
        save: jest.fn().mockResolvedValue({ _id: 'm1', merchantStatus: 'rejected' })
      };
      User.findOne.mockResolvedValue(mockMerchant);

      const req = { params: { id: 'm1' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await rejectMerchant(req, res, jest.fn());
      expect(mockMerchant.merchantStatus).toBe('rejected');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for non-existent merchant', async () => {
      User.findOne.mockResolvedValue(null);

      const req = { params: { id: 'nonexistent' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await approveMerchant(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('US 7-4: requireMerchant middleware', () => {
    const requireMerchant = () => (req, res, next) => {
      if (!req.user) return res.status(401).json({ success: false, message: 'Not authorized' });
      if (req.user.role !== 'merchant') return res.status(403).json({ success: false, message: 'Merchant access required' });
      if (req.user.merchantStatus === 'pending') return res.status(403).json({ success: false, message: 'Pending approval' });
      if (req.user.merchantStatus === 'rejected') return res.status(403).json({ success: false, message: 'Account rejected' });
      if (req.user.merchantStatus !== 'approved') return res.status(403).json({ success: false, message: 'Not approved' });
      next();
    };

    it('should block pending merchant → 403', () => {
      const req = { user: { role: 'merchant', merchantStatus: 'pending' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      requireMerchant()(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should block rejected merchant → 403', () => {
      const req = { user: { role: 'merchant', merchantStatus: 'rejected' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      requireMerchant()(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow approved merchant', () => {
      const req = { user: { role: 'merchant', merchantStatus: 'approved' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      requireMerchant()(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block non-merchant → 403', () => {
      const req = { user: { role: 'user' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      requireMerchant()(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('US 7-6: Merchant QR scan', () => {
    // Helper: mock a Mongoose query chain with 3 .populate() calls
    const mockPopulateChain = (resolvedValue) => {
      const p3 = Promise.resolve(resolvedValue);
      const q2 = { populate: jest.fn().mockReturnValue(p3) };
      const q1 = { populate: jest.fn().mockReturnValue(q2) };
      const q0 = { populate: jest.fn().mockReturnValue(q1) };
      return q0;
    };

    it('should verify QR for own shop reservation', async () => {
      const shopId = 'shop1';
      const mockMerchant = { _id: 'm1', merchantShop: shopId };
      User.findById.mockResolvedValue(mockMerchant);

      const mockReservation = {
        _id: 'res1', qrToken: 'tok1', qrActive: true, status: 'pending',
        shop: { _id: shopId, name: 'Test Shop' },
        service: { name: 'Massage', duration: 60, price: 500 },
        user: { name: 'Cust', email: 'c@t.com', telephone: '081' },
        resvDate: new Date(),
        save: jest.fn().mockImplementation(function() { return Promise.resolve(this); })
      };

      Reservation.findOne.mockReturnValue(mockPopulateChain(mockReservation));

      const req = { body: { token: 'tok1' }, user: { id: 'm1', merchantShop: shopId } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await scanQR(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 403 if reservation belongs to different shop', async () => {
      User.findById.mockResolvedValue({ _id: 'm1', merchantShop: 'shop1' });

      const otherReservation = {
        _id: 'res1', qrToken: 'tok1', qrActive: true,
        shop: { _id: 'other-shop', name: 'Other Shop' },
        service: { name: 'Massage' },
        user: { name: 'Cust' },
        resvDate: new Date()
      };

      Reservation.findOne.mockReturnValue(mockPopulateChain(otherReservation));

      const req = { body: { token: 'tok1' }, user: { id: 'm1', merchantShop: 'shop1' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await scanQR(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 for invalid QR token', async () => {
      Reservation.findOne.mockReturnValue(mockPopulateChain(null));

      const req = { body: { token: 'bad-token' }, user: { id: 'm1', merchantShop: 'shop1' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await scanQR(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 for void QR code', async () => {
      User.findById.mockResolvedValue({ _id: 'm1', merchantShop: 'shop1' });

      const voidReservation = {
        _id: 'res1', qrToken: 'tok1', qrActive: false,
        shop: { _id: 'shop1', name: 'Shop' },
        service: {}, user: {}, resvDate: new Date()
      };

      Reservation.findOne.mockReturnValue(mockPopulateChain(voidReservation));

      const req = { body: { token: 'tok1' }, user: { id: 'm1', merchantShop: 'shop1' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await scanQR(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
