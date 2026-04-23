'use strict';

/**
 * EPIC 3: Google Place v1 API — Tests
 * 
 * US 3-1: Customer view — Google API photo with fallback
 * US 3-2: Admin view — same fallback logic
 * 
 * Tests cover:
 * - Google API available → shows Google photo (proxied)
 * - Google API down / no placeId → shows MongoDB fallback photo
 * - No photo at all → 404
 */

jest.mock('../models/MassageShop');
jest.mock('../utils/google/places');
jest.mock('../models/Review', () => ({
  aggregate: jest.fn().mockResolvedValue([]),
}));

const MassageShop = require('../models/MassageShop');
const { getPlacePhotoBuffer, getFallbackPhotoUrl } = require('../utils/google/places');
const Review = require('../models/Review');
const { getShopPhoto, getShops, getShop } = require('../controllers/shops');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return {
    params: { id: '663000000000000000000001' },
    query: {},
    protocol: 'https',
    get: jest.fn().mockReturnValue('api.example.com'),
    ...overrides,
  };
}

const SHOP_ID = '663000000000000000000001';

// Mock MassageShop.findById to support .lean() chain
function mockFindByIdLean(result) {
  MassageShop.findById.mockReturnValue({
    lean: jest.fn().mockResolvedValue(result)
  });
}

beforeEach(() => jest.clearAllMocks());

// ─── getShopPhoto (EPIC 3: Google API with fallback) ──────────────────────────

describe('EPIC 3 — getShopPhoto: Google Places API with fallback', () => {

  it('TC-EP3-1: Google API available → returns Google photo (proxied as binary)', async () => {
    mockFindByIdLean({
      _id: SHOP_ID,
      placeId: 'ChIJ_test_place_id',
      photo: 'https://example.com/fallback.jpg',
    });

    getPlacePhotoBuffer.mockResolvedValue({
      buffer: Buffer.from('fake-image-data'),
      contentType: 'image/jpeg',
    });

    const req = mockReq();
    const res = mockRes();

    await getShopPhoto(req, res, next);

    expect(getPlacePhotoBuffer).toHaveBeenCalledWith({ placeId: 'ChIJ_test_place_id' });
    expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400');
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('TC-EP3-2: Google API down / no placeId → shows MongoDB fallback photo', async () => {
    mockFindByIdLean({
      _id: SHOP_ID,
      placeId: null,
      photo: 'https://example.com/mongodb-photo.jpg',
    });

    getFallbackPhotoUrl.mockReturnValue('https://example.com/mongodb-photo.jpg');

    const req = mockReq({ query: { fallback: '1' } });
    const res = mockRes();

    await getShopPhoto(req, res, next);

    expect(getPlacePhotoBuffer).not.toHaveBeenCalled();
    expect(getFallbackPhotoUrl).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('https://example.com/mongodb-photo.jpg');
  });

  it('TC-EP3-3: Google API fails but shop has placeId → falls back to MongoDB photo', async () => {
    mockFindByIdLean({
      _id: SHOP_ID,
      placeId: 'ChIJ_test_place_id',
      photo: 'https://example.com/fallback.jpg',
    });

    getPlacePhotoBuffer.mockResolvedValue(null);
    getFallbackPhotoUrl.mockReturnValue('https://example.com/fallback.jpg');

    const req = mockReq({ query: { fallback: '1' } });
    const res = mockRes();

    await getShopPhoto(req, res, next);

    expect(getPlacePhotoBuffer).toHaveBeenCalledWith({ placeId: 'ChIJ_test_place_id' });
    expect(getFallbackPhotoUrl).toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('https://example.com/fallback.jpg');
  });

  it('TC-EP3-4: No Google photo and no MongoDB photo → 404', async () => {
    mockFindByIdLean({
      _id: SHOP_ID,
      placeId: null,
      photo: null,
      photos: [],
    });

    getFallbackPhotoUrl.mockReturnValue(null);

    const req = mockReq();
    const res = mockRes();

    await getShopPhoto(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('No photo') })
    );
  });

  it('TC-EP3-5: Shop not found → 404', async () => {
    mockFindByIdLean(null);

    const req = mockReq();
    const res = mockRes();

    await getShopPhoto(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('not found') })
    );
  });

  it('TC-EP3-6: Fallback=0 skips MongoDB fallback', async () => {
    mockFindByIdLean({
      _id: SHOP_ID,
      placeId: 'ChIJ_test',
      photo: 'https://example.com/fallback.jpg',
    });

    getPlacePhotoBuffer.mockResolvedValue(null);
    getFallbackPhotoUrl.mockReturnValue('https://example.com/fallback.jpg');

    const req = mockReq({ query: { fallback: '0' } });
    const res = mockRes();

    await getShopPhoto(req, res, next);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── getShops / getShop: hasGooglePhoto flag (EPIC 3) ─────────────────────────

describe('EPIC 3 — getShops: hasGooglePhoto flag', () => {

  it('TC-EP3-7: Shops with placeId have hasGooglePhoto=true', async () => {
    MassageShop.countDocuments.mockResolvedValue(1);
    MassageShop.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              { _id: SHOP_ID, name: 'Test Shop', placeId: 'ChIJ_test' }
            ])
          })
        })
      })
    });

    const req = mockReq({ query: {} });
    const res = mockRes();

    await getShops(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const call = res.json.mock.calls[0][0];
    expect(call.data[0].hasGooglePhoto).toBe(true);
  });

  it('TC-EP3-8: Shops without placeId have hasGooglePhoto=false', async () => {
    MassageShop.countDocuments.mockResolvedValue(1);
    MassageShop.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              { _id: SHOP_ID, name: 'Test Shop', placeId: null }
            ])
          })
        })
      })
    });

    const req = mockReq({ query: {} });
    const res = mockRes();

    await getShops(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const call = res.json.mock.calls[0][0];
    expect(call.data[0].hasGooglePhoto).toBe(false);
  });
});

describe('EPIC 3 — getShop: hasGooglePhoto flag', () => {

  it('TC-EP3-9: Single shop with placeId has hasGooglePhoto=true', async () => {
    MassageShop.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: SHOP_ID,
          name: 'Test Shop',
          placeId: 'ChIJ_test',
        })
      })
    });

    const req = mockReq();
    const res = mockRes();

    await getShop(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const call = res.json.mock.calls[0][0];
    expect(call.data.hasGooglePhoto).toBe(true);
  });

  it('TC-EP3-10: Single shop without placeId has hasGooglePhoto=false', async () => {
    MassageShop.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: SHOP_ID,
          name: 'Test Shop',
          placeId: null,
        })
      })
    });

    const req = mockReq();
    const res = mockRes();

    await getShop(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const call = res.json.mock.calls[0][0];
    expect(call.data.hasGooglePhoto).toBe(false);
  });
});

// Dummy next function
function next(err) { throw err; }
