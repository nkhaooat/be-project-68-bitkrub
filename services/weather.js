/**
 * Server-side weather fetch via Open-Meteo.
 * No API key needed. Accepts optional lat/lng for location-specific weather.
 * Falls back to Bangkok (13.75, 100.5) if no coords provided.
 */

const BANGKOK_LAT = 13.75;
const BANGKOK_LNG = 100.5;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Simple cache — keyed by rounded lat/lng
let cache = { key: '', data: null, ts: 0 };

function cacheKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/**
 * Fetch current weather from Open-Meteo.
 * @param {{ lat?: number, lng?: number }} coords - optional, defaults to Bangkok
 * @returns {Promise<{ temp: number, wind: number, rainChance: number } | null>}
 */
async function fetchWeather(coords = {}) {
  const lat = coords.lat ?? BANGKOK_LAT;
  const lng = coords.lng ?? BANGKOK_LNG;

  const key = cacheKey(lat, lng);
  const now = Date.now();

  // Return cached if fresh
  if (cache.key === key && cache.data && now - cache.ts < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,precipitation_probability&timezone=Asia/Bangkok`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const json = await res.json();
    const data = {
      temp: json.current?.temperature_2m,
      wind: json.current?.wind_speed_10m,
      rainChance: json.current?.precipitation_probability,
    };

    if (data.temp == null) return null;

    cache = { key, data, ts: now };
    return data;
  } catch (err) {
    console.warn('[weather] Open-Meteo fetch failed:', err.message);
    // Return stale cache if available (better than nothing)
    if (cache.data) return cache.data;
    return null;
  }
}

/** Prefetch Bangkok weather at startup so first query is instant */
function prefetchBangkok() {
  fetchWeather({ lat: BANGKOK_LAT, lng: BANGKOK_LNG })
    .then(d => d ? console.log(`[weather] Prefetched Bangkok: ${d.temp}°C`) : console.log('[weather] Prefetch failed'))
    .catch(() => {});
}

/** Check if a message is weather-related */
function isWeatherQuery(text) {
  return /weather|rain|hot|temperature|wind|umbrella|อากาศ|ฝน|ร้อน|ลม|หนาว|forecast/i.test(text || '');
}

module.exports = { fetchWeather, prefetchBangkok, isWeatherQuery };
