/**
 * Geo helpers for the chatbot — haversine distance, anchor detection.
 *
 * Anchor data is loaded from utils/geo/geo_anchors.csv at module load time.
 */

const path = require('path');

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ---------------------------------------------------------------------------
// Anchor data (loaded once at module init)
// ---------------------------------------------------------------------------

let GEO_ALIASES = [];
try {
  const { loadAnchors } = require('./loadAnchors');
  GEO_ALIASES = loadAnchors(path.join(__dirname, 'geo_anchors.csv'));
  // Add a few hardcoded extras/variants
  const pushExtra = (labels, lat, lng) => GEO_ALIASES.push({ labels: labels.map(l => l.toLowerCase()), lat, lng });
  pushExtra(['bts พญาไท','arl พญาไท','bts phaya thai','arl phaya thai','phyathai','payathai'], 13.7565, 100.5325);
} catch (e) {
  // Fallback to minimal in-file anchors if loader fails
  GEO_ALIASES = [
    { labels: ['พญาไท','phaya thai','phyathai','payathai'], lat: 13.7810, lng: 100.5428 },
    { labels: ['ราชเทวี','ratchathewi','victory monument','อนุสาวรีย์ชัยสมรภูมิ'], lat: 13.7589, lng: 100.5344 },
    { labels: ['สยาม','siam','siam square','pathum wan','ปทุมวัน'], lat: 13.7449, lng: 100.5222 },
  ];
}

// ---------------------------------------------------------------------------
// Anchor detection
// ---------------------------------------------------------------------------

/**
 * Detect a geo anchor in the user's message.
 * Returns { lat, lng, labels, nearIntent } or null.
 *
 * @param {string} text - User message
 * @returns {{ lat: number, lng: number, labels: string[], nearIntent: boolean } | null}
 */
function detectGeoAnchor(text, userCoords) {
  const q = (text || '').toLowerCase();
  const nearIntent = /(near|around|ใกล้|แถว|ย่าน|บริเวณ|โซน|near me|nearby|close to|ร้านนวดใกล้ฉัน|ใกล้ฉัน|ใกล้ตัว)/i.test(q);

  // Check named anchors first
  for (const spot of GEO_ALIASES) {
    if (spot.labels.some(lbl => q.includes(lbl))) {
      return { ...spot, nearIntent: true };
    }
  }

  // "near me" / ใกล้ฉัน — use browser geolocation if available
  if (nearIntent && userCoords && typeof userCoords.lat === 'number' && typeof userCoords.lng === 'number') {
    return { lat: userCoords.lat, lng: userCoords.lng, labels: ['user location'], nearIntent: true };
  }

  return null;
}

module.exports = { haversineKm, detectGeoAnchor, GEO_ALIASES };
