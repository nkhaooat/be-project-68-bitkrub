'use strict';

// ─── Mock Models ─────────────────────────────────────────────────────────────
jest.mock('../models/MassageShop');
const MassageShop = require('../models/MassageShop');
const { addTiktokLinks } = require('../utils/addTiktokLinks');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

const SHOP_ID = '663000000000000000000001';

beforeEach(() => jest.clearAllMocks());

// ─── addTiktokLinks ───────────────────────────────────────────────────────────
describe('addTiktokLinks', () => {

  it('TC-T1: rejects when links array is missing', async () => {
    const req = { params: { id: SHOP_ID }, body: {} };
    const res = mockRes();

    await addTiktokLinks(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('links') })
    );
  });

  it('TC-T2: rejects when links is not an array', async () => {
    const req = { params: { id: SHOP_ID }, body: { links: 'not-an-array' } };
    const res = mockRes();

    await addTiktokLinks(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('TC-T3: rejects when links array is empty', async () => {
    const req = { params: { id: SHOP_ID }, body: { links: [] } };
    const res = mockRes();

    await addTiktokLinks(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('TC-T4: rejects when no valid TikTok URLs provided', async () => {
    const req = { params: { id: SHOP_ID }, body: { links: ['https://youtube.com/shorts/abc'] } };
    const res = mockRes();

    await addTiktokLinks(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('No valid TikTok') })
    );
  });

  it('TC-T5: rejects when shop not found', async () => {
    MassageShop.findByIdAndUpdate = jest.fn().mockResolvedValue(null);

    const req = { params: { id: SHOP_ID }, body: { links: ['https://tiktok.com/@user/video/123'] } };
    const res = mockRes();

    await addTiktokLinks(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('not found') })
    );
  });

  it('TC-T6: adds valid TikTok links successfully', async () => {
    const updatedShop = { tiktokLinks: ['https://tiktok.com/@user/video/123'] };
    MassageShop.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedShop);

    const req = { params: { id: SHOP_ID }, body: { links: ['https://tiktok.com/@user/video/123'] } };
    const res = mockRes();

    await addTiktokLinks(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: updatedShop.tiktokLinks })
    );
  });

  it('TC-T7: filters out invalid URLs and keeps only valid TikTok links', async () => {
    const updatedShop = { tiktokLinks: ['https://tiktok.com/@user/video/123'] };
    MassageShop.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedShop);

    const req = {
      params: { id: SHOP_ID },
      body: {
        links: [
          'https://tiktok.com/@user/video/123',
          'https://youtube.com/shorts/invalid',
          'not-a-url',
          12345,
        ],
      },
    };
    const res = mockRes();

    await addTiktokLinks(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(MassageShop.findByIdAndUpdate).toHaveBeenCalledWith(
      SHOP_ID,
      expect.objectContaining({ $addToSet: expect.any(Object) }),
      expect.objectContaining({ new: true })
    );
  });

  it('TC-T8: handles unexpected database error', async () => {
    MassageShop.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('DB error'));

    const req = { params: { id: SHOP_ID }, body: { links: ['https://tiktok.com/@user/video/123'] } };
    const res = mockRes();

    await addTiktokLinks(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'DB error' })
    );
  });
});
