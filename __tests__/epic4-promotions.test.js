'use strict';

// ─── Mock Models ─────────────────────────────────────────────────────────────
jest.mock('../models/Promotion');
jest.mock('../models/Reservation');
jest.mock('../services/email', () => ({
  sendConfirmationEmail: jest.fn(),
  sendCancellationEmail: jest.fn(),
  sendReviewRequestEmail: jest.fn(),
}));
jest.mock('../services/promotions', () => ({
  applyPromotionCode: jest.fn(),
}));
const Promotion = require('../models/Promotion');
const Reservation = require('../models/Reservation');
const promotionsCtrl = require('../controllers/promotions');
const reservationsCtrl = require('../controllers/reservations');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

beforeEach(() => jest.clearAllMocks());

// ─── EPIC 4: US 4-1 — Promotion Validation ──────────────────────────────────

describe('EPIC 4 — US 4-1: Promotion Validation', () => {

    test('TC-EP4-1: Valid flat discount code', async () => {
        Promotion.findOne.mockResolvedValue({
            code: 'FLAT100', name: '100 Baht Off', discountType: 'flat',
            discountValue: 100, isActive: true,
            expiresAt: new Date(Date.now() + 86400000),
            usageLimit: 10, usedCount: 0
        });

        const req = { body: { code: 'FLAT100', originalPrice: 500 } };
        const res = mockRes();
        await promotionsCtrl.validatePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({ discountAmount: 100, finalPrice: 400 })
        }));
    });

    test('TC-EP4-2: Valid percentage discount code', async () => {
        Promotion.findOne.mockResolvedValue({
            code: 'PCT20', name: '20% Off', discountType: 'percentage',
            discountValue: 20, isActive: true,
            expiresAt: new Date(Date.now() + 86400000),
            usageLimit: null, usedCount: 0
        });

        const req = { body: { code: 'PCT20', originalPrice: 1000 } };
        const res = mockRes();
        await promotionsCtrl.validatePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({ discountAmount: 200, finalPrice: 800 })
        }));
    });

    test('TC-EP4-3: Invalid promotion code → 404', async () => {
        Promotion.findOne.mockResolvedValue(null);

        const req = { body: { code: 'INVALID', originalPrice: 500 } };
        const res = mockRes();
        await promotionsCtrl.validatePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false, message: 'Invalid promotion code'
        }));
    });

    test('TC-EP4-4: Expired promotion code', async () => {
        Promotion.findOne.mockResolvedValue({
            code: 'EXPIRED1', isActive: true,
            expiresAt: new Date(Date.now() - 86400000),
            usageLimit: null, usedCount: 0
        });

        const req = { body: { code: 'EXPIRED1', originalPrice: 500 } };
        const res = mockRes();
        await promotionsCtrl.validatePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false, message: expect.stringContaining('expired')
        }));
    });

    test('TC-EP4-5: Usage limit reached', async () => {
        Promotion.findOne.mockResolvedValue({
            code: 'LIMIT1', isActive: true,
            expiresAt: new Date(Date.now() + 86400000),
            usageLimit: 2, usedCount: 2
        });

        const req = { body: { code: 'LIMIT1', originalPrice: 500 } };
        const res = mockRes();
        await promotionsCtrl.validatePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false, message: expect.stringContaining('usage limit')
        }));
    });

    test('TC-EP4-6: Discount capped at original price', async () => {
        Promotion.findOne.mockResolvedValue({
            code: 'HUGE2000', discountType: 'flat', discountValue: 2000,
            isActive: true,
            expiresAt: new Date(Date.now() + 86400000),
            usageLimit: null, usedCount: 0
        });

        const req = { body: { code: 'HUGE2000', originalPrice: 500 } };
        const res = mockRes();
        await promotionsCtrl.validatePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({ discountAmount: 500, finalPrice: 0 })
        }));
    });
});

// ─── EPIC 4: US 4-3 — Admin Promotion CRUD ──────────────────────────────────

describe('EPIC 4 — US 4-3: Admin Promotion CRUD', () => {

    test('TC-EP4-7: Admin creates promotion', async () => {
        Promotion.create.mockResolvedValue({
            code: 'NEWPROMO', name: 'New Promo', discountType: 'flat', discountValue: 50
        });

        const req = {
            body: {
                code: 'NEWPROMO', name: 'New Promo', discountType: 'flat',
                discountValue: 50, expiresAt: new Date(Date.now() + 86400000).toISOString()
            }
        };
        const res = mockRes();
        await promotionsCtrl.createPromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true, data: expect.objectContaining({ code: 'NEWPROMO' })
        }));
    });

    test('TC-EP4-8: Duplicate promotion code → rejected', async () => {
        Promotion.create.mockRejectedValue({ code: 11000 });

        const req = {
            body: {
                code: 'DUPCODE', name: 'Second', discountType: 'flat',
                discountValue: 50, expiresAt: new Date(Date.now() + 86400000).toISOString()
            }
        };
        const res = mockRes();
        await promotionsCtrl.createPromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false, message: expect.stringContaining('already exists')
        }));
    });

    test('TC-EP4-9: Admin lists promotions', async () => {
        Promotion.find.mockReturnValue({
            sort: jest.fn().mockResolvedValue([
                { code: 'PROMO1', name: 'Test', discountType: 'flat', discountValue: 50 }
            ])
        });

        const req = {};
        const res = mockRes();
        await promotionsCtrl.getPromotions(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true, count: 1
        }));
    });

    test('TC-EP4-10: Admin deactivates promotion', async () => {
        const mockSave = jest.fn().mockResolvedValue();
        const promo = { isActive: true, save: mockSave };
        Promotion.findById.mockResolvedValue(promo);

        const req = { params: { id: 'abc123' } };
        const res = mockRes();
        await promotionsCtrl.deletePromotion(req, res);

        expect(promo.isActive).toBe(false);
        expect(mockSave).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('TC-EP4-11: Deactivate non-existent promotion → 404', async () => {
        Promotion.findById.mockResolvedValue(null);

        const req = { params: { id: 'nonexistent' } };
        const res = mockRes();
        await promotionsCtrl.deletePromotion(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

// ─── EPIC 4: US 4-4 — Admin Verify Slip ──────────────────────────────────────

describe('EPIC 4 — US 4-4: Admin Verify Slip', () => {

    test('TC-EP4-12: Approve slip → confirmed + approved', async () => {
        const mockSave = jest.fn().mockResolvedValue();
        const reservation = {
            paymentStatus: 'waiting_verification',
            status: 'pending',
            save: mockSave,
            _id: 'resv1'
        };
        Reservation.findById.mockResolvedValueOnce(reservation);
        // Second call for populate after save (array-style populate)
        Reservation.findById.mockReturnValueOnce({
            populate: jest.fn().mockResolvedValue({
                paymentStatus: 'approved',
                status: 'confirmed',
                _id: 'resv1'
            })
        });

        const req = { params: { id: 'resv1' }, body: { action: 'approve' } };
        const res = mockRes();
        await reservationsCtrl.verifySlip(req, res);

        expect(reservation.paymentStatus).toBe('approved');
        expect(reservation.status).toBe('confirmed');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('TC-EP4-13: Reject slip → paymentStatus rejected', async () => {
        const mockSave = jest.fn().mockResolvedValue();
        const reservation = {
            paymentStatus: 'waiting_verification',
            status: 'pending',
            save: mockSave,
            _id: 'resv2'
        };
        Reservation.findById.mockResolvedValueOnce(reservation);
        Reservation.findById.mockReturnValueOnce({
            populate: jest.fn().mockResolvedValue({
                paymentStatus: 'rejected',
                status: 'pending',
                _id: 'resv2'
            })
        });

        const req = { params: { id: 'resv2' }, body: { action: 'reject' } };
        const res = mockRes();
        await reservationsCtrl.verifySlip(req, res);

        expect(reservation.paymentStatus).toBe('rejected');
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('TC-EP4-14: Verify non-waiting reservation → error', async () => {
        Reservation.findById.mockResolvedValue({
            paymentStatus: 'none', _id: 'resv3'
        });

        const req = { params: { id: 'resv3' }, body: { action: 'approve' } };
        const res = mockRes();
        await reservationsCtrl.verifySlip(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('TC-EP4-15: Invalid action → error', async () => {
        const req = { params: { id: 'resv1' }, body: { action: 'invalid' } };
        const res = mockRes();
        await reservationsCtrl.verifySlip(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});
