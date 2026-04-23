const fetch = require('node-fetch');

/**
 * Google Places v1 API helper for shop photos.
 * 
 * Flow:
 * 1. If shop has placeId → fetch photo from Google Places API
 * 2. If Google API fails or no placeId → return null (caller falls back to DB photo)
 */

/**
 * Get a Google Places photo URL for a shop.
 * Returns the direct media URL or null if unavailable.
 * 
 * @param {Object} options
 * @param {string} options.placeId - Google Place ID
 * @param {number} [options.maxWidthPx=800] - Max photo width
 * @param {number} [options.maxHeightPx=600] - Max photo height
 * @returns {Promise<string|null>} Photo media URL or null
 */
async function getPlacePhotoUrl({ placeId, maxWidthPx = 800, maxHeightPx = 600 }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !placeId) return null;

  try {
    // Step 1: Fetch place details to get photo resource name
    const detailsUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=photos`;
    const dResp = await fetch(detailsUrl, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'photos'
      },
      timeout: 5000 // 5s timeout
    });

    if (!dResp.ok) return null;

    const dJson = await dResp.json();
    const photoName = dJson.photos?.[0]?.name; // e.g., "places/ABC/photos/DEF"

    if (!photoName) return null;

    // Step 2: Build the media URL
    return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}&key=${apiKey}`;
  } catch (e) {
    // Timeout, network error, or parsing error — fall back silently
    return null;
  }
}

/**
 * Fetch a Google Places photo as a binary buffer (for proxying).
 * Returns { buffer, contentType } or null if unavailable.
 * 
 * @param {Object} options
 * @param {string} options.placeId - Google Place ID
 * @param {number} [options.maxWidthPx=800]
 * @param {number} [options.maxHeightPx=600]
 * @returns {Promise<{buffer: Buffer, contentType: string}|null>}
 */
async function getPlacePhotoBuffer({ placeId, maxWidthPx = 800, maxHeightPx = 600 }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !placeId) return null;

  try {
    // Step 1: Get photo resource name
    const detailsUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=photos`;
    const dResp = await fetch(detailsUrl, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'photos'
      },
      timeout: 5000
    });

    if (!dResp.ok) return null;

    const dJson = await dResp.json();
    const photoName = dJson.photos?.[0]?.name;

    if (!photoName) return null;

    // Step 2: Fetch the actual photo binary
    const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}`;
    const pResp = await fetch(mediaUrl, {
      headers: { 'X-Goog-Api-Key': apiKey },
      timeout: 10000
    });

    if (!pResp.ok) return null;

    const contentType = pResp.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await pResp.arrayBuffer());

    return { buffer, contentType };
  } catch (e) {
    return null;
  }
}

/**
 * Get the fallback photo URL from a shop document.
 * Checks shop.photo first, then shop.photos array.
 * 
 * @param {Object} shop - Mongoose shop document (plain object)
 * @returns {string|null} Fallback photo URL or null
 */
function getFallbackPhotoUrl(shop) {
  if (shop.photo) return shop.photo;
  if (Array.isArray(shop.photos) && shop.photos.length > 0) return shop.photos[0];
  return null;
}

module.exports = { getPlacePhotoUrl, getPlacePhotoBuffer, getFallbackPhotoUrl };
