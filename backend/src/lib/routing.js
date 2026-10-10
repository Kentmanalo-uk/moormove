/**
 * How far apart two pins are by road, for fares. Asks an OSRM route
 * service (ROUTING_URL):
 *
 *   ROUTING_URL  default https://router.project-osrm.org (OSRM's public demo
 *                server: fine for MoorMove's volume today; swap it for a
 *                self-hosted or paid OSRM-compatible URL as deliveries grow).
 *                "off" never asks: every distance is an estimate.
 *
 * When the route service is off, down, slow (4 s) or finds no road, the
 * distance is an estimate: the straight line × the road factor (1.3 unless
 * the admin's settings say otherwise), marked source ESTIMATE. Answers are
 * kept in memory by both pins rounded to 4 decimals (about 11 m), and one
 * question per pair is asked at a time. ROUTING_URL is read on each call.
 */
const { haversineKm } = require('./geo');

const DEFAULT_URL = 'https://router.project-osrm.org';
const TIMEOUT_MS = 4000;
// Roads don't move: a road distance is good for a day; an estimate (the
// route service was out) only for a minute, so the road is asked again soon.
const ROAD_TTL_MS = 24 * 3600 * 1000;
const ESTIMATE_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 5000;
const ROAD_FACTOR = 1.3;
// Average town driving speed for an estimate's minutes.
const ESTIMATE_KMH = 30;

const routingUrl = () => {
  const raw = String(process.env.ROUTING_URL ?? '').trim();
  if (!raw) return DEFAULT_URL;
  if (/^(off|false|0|none|disabled)$/i.test(raw)) return null;
  return raw.replace(/\/+$/, '');
};

const round1 = (n) => Math.round(n * 10) / 10;

/** The straight line × the road factor, when the road can't be asked. */
const estimate = (a, b, factor = ROAD_FACTOR) => {
  const km = round1(haversineKm(a, b) * (Number(factor) > 0 ? Number(factor) : ROAD_FACTOR));
  return { km, minutes: Math.max(1, Math.round((km / ESTIMATE_KMH) * 60)), source: 'ESTIMATE' };
};

/** OSRM's answer for a to b, or null (no road, an error, too slow). */
const askRoute = async (url, a, b) => {
  try {
    const res = await fetch(
      `${url}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false&alternatives=false&steps=false`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const route = json?.code === 'Ok' && Array.isArray(json.routes) ? json.routes[0] : null;
    const meters = Number(route?.distance);
    const seconds = Number(route?.duration);
    if (!Number.isFinite(meters) || meters < 0) return null;
    return {
      km: round1(meters / 1000),
      minutes: Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null,
      source: 'ROAD',
    };
  } catch {
    return null;
  }
};

const cache = new Map();
const inFlight = new Map();

const remember = (key, value, ttl) => {
  if (cache.size >= MAX_ENTRIES) {
    // Oldest first (a Map keeps insertion order).
    for (const k of cache.keys()) {
      cache.delete(k);
      if (cache.size < MAX_ENTRIES * 0.9) break;
    }
  }
  cache.set(key, { value, expires: Date.now() + ttl });
};

/**
 * How far it is by road from one pin to another.
 * @param {{lat: Number, lng: Number}} from
 * @param {{lat: Number, lng: Number}} to
 * @param {{ roadFactor?: Number }} [options] - for an estimate
 * @returns {Promise<{ km: Number, minutes: Number|null, source: 'ROAD'|'ESTIMATE' }>}
 */
const roadDistance = async (from, to, { roadFactor } = {}) => {
  const a = { lat: Number(from.lat), lng: Number(from.lng) };
  const b = { lat: Number(to.lat), lng: Number(to.lng) };
  if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) throw new Error('roadDistance needs two pins');
  const url = routingUrl();
  if (!url) return estimate(a, b, roadFactor);

  const key = `${url}|${a.lat.toFixed(4)},${a.lng.toFixed(4)};${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    const road = await askRoute(url, a, b);
    const answer = road || estimate(a, b, roadFactor);
    remember(key, answer, road ? ROAD_TTL_MS : ESTIMATE_TTL_MS);
    return answer;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
};

/** Forget every answer (tests). */
const clear = () => cache.clear();

module.exports = { roadDistance, estimate, routingUrl, clear, DEFAULT_URL };
