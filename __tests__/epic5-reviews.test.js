const Review = require('../models/Review');
const Reservation = require('../models/Reservation');
const mongoose = require('mongoose');

// Mock models
jest.mock('../models/Review');
jest.mock('../models/Reservation');
jest.mock('../models/MassageShop');

// Mock autoComplete
Reservation.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const {
  createReview,
  getShopReviews,
  getMyReviews,
  checkReview,
} = require('../controllers/reviews');

describe('EPIC 5 — Reviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/reviews — createReview', () => {
    it('should create a review for a completed reservation', async () => {
      const req = {
        body: { reservationId: 'res1', rating: 5, comment: 'Great!' },
        user: { id: 'user1' },
      };
      const res = mockRes();

      Reservation.findById.mockReturnValue({
        user: { toString: () => 'user1' },
        shop: 'shop1',
        service: 'service1',
        status: 'completed',
      });
      Review.findOne.mockResolvedValue(null);
      Review.create.mockResolvedValue({
        _id: 'rev1',
        reservation: 'res1',
        user: 'user1',
        shop: 'shop1',
        service: 'service1',
        rating: 5,
        comment: 'Great!',
      });

      await createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('should reject review for non-completed reservation', async () => {
      const req = {
        body: { reservationId: 'res1', rating: 4 },
        user: { id: 'user1' },
      };
      const res = mockRes();

      Reservation.findById.mockReturnValue({
        user: { toString: () => 'user1' },
        status: 'pending',
      });

      await createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject duplicate review', async () => {
      const req = {
        body: { reservationId: 'res1', rating: 4 },
        user: { id: 'user1' },
      };
      const res = mockRes();

      Reservation.findById.mockReturnValue({
        user: { toString: () => 'user1' },
        shop: 'shop1',
        service: 'service1',
        status: 'completed',
      });
      Review.findOne.mockResolvedValue({ _id: 'existing' });

      await createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject review from different user', async () => {
      const req = {
        body: { reservationId: 'res1', rating: 4 },
        user: { id: 'user2' },
      };
      const res = mockRes();

      Reservation.findById.mockReturnValue({
        user: { toString: () => 'user1' },
        status: 'completed',
      });

      await createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should require reservationId and rating', async () => {
      const req = {
        body: { comment: 'Nice' },
        user: { id: 'user1' },
      };
      const res = mockRes();

      await createReview(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('GET /api/v1/reviews/shop/:shopId — getShopReviews', () => {
    it('should return reviews with avgRating and reviewCount', async () => {
      const req = { params: { shopId: new mongoose.Types.ObjectId().toString() } };
      const res = mockRes();

      const mockReviews = [
        { _id: 'r1', rating: 5, comment: 'Amazing', user: { name: 'Alice' }, service: { name: 'Thai' } },
        { _id: 'r2', rating: 3, comment: 'OK', user: { name: 'Bob' }, service: { name: 'Oil' } },
      ];

      Review.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockReviews),
            }),
          }),
        }),
      });

      Review.aggregate.mockResolvedValue([
        { _id: null, avgRating: 4.0, count: 2 },
      ]);

      await getShopReviews(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          avgRating: 4.0,
          reviewCount: 2,
          count: 2,
        })
      );
    });

    it('should return 0 avgRating when no reviews exist', async () => {
      const req = { params: { shopId: new mongoose.Types.ObjectId().toString() } };
      const res = mockRes();

      Review.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      Review.aggregate.mockResolvedValue([]);

      await getShopReviews(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          avgRating: 0,
          reviewCount: 0,
        })
      );
    });
  });

  describe('GET /api/v1/reviews/my — getMyReviews', () => {
    it('should return current user reviews', async () => {
      const req = { user: { id: 'user1' } };
      const res = mockRes();

      Review.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([{ _id: 'r1', rating: 5 }]),
          }),
        }),
      });

      await getMyReviews(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('GET /api/v1/reviews/check/:reservationId — checkReview', () => {
    it('should return reviewed=true if review exists', async () => {
      const req = { params: { reservationId: 'res1' }, user: { id: 'user1' } };
      const res = mockRes();

      Review.findOne.mockResolvedValue({ _id: 'r1' });

      await checkReview(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ reviewed: true })
      );
    });

    it('should return reviewed=false if no review', async () => {
      const req = { params: { reservationId: 'res1' }, user: { id: 'user1' } };
      const res = mockRes();

      Review.findOne.mockResolvedValue(null);

      await checkReview(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ reviewed: false })
      );
    });
  });
});
