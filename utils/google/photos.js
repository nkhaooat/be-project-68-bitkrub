const fetch = require('node-fetch');

// Build a Places Photo URL (v1 photo service) from a photo reference or by Place ID via place details
// If it fails, return null so caller can fall back to DB photo.
// Requires process.env.GOOGLE_MAPS_API_KEY

async function getPlacePhotoUrl({ placeId, maxWidth = 800, maxHeight = 600, photoRef = null }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    let ref = photoRef;
    if (!ref && placeId) {
      // Fetch place details to get a photo reference
      const detailsUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=photos&key=${apiKey}`;
      const dResp = await fetch(detailsUrl, { headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'photos' } });
      if (!dResp.ok) return null;
      const dJson = await dResp.json();
      ref = dJson.photos && dJson.photos[0] && dJson.photos[0].name; // v1 returns resource name like "places/XYZ/photos/ABC"
    }

    if (!ref) return null;

    // Photo media URL (binary). We can return a URL that proxies through Google; frontend may need to fetch and cache.
    // For web apps, it's common to pipe via backend to avoid leaking API keys.
    const photoUrl = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${maxWidth}&maxHeightPx=${maxHeight}&key=${apiKey}`;
    return photoUrl;
  } catch (e) {
    return null;
  }
}

module.exports = { getPlacePhotoUrl };