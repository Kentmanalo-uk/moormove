/**
 * How far apart two pins are by road, for fares. Asks an OSRM route
 * service (ROUTING_URL):
 *
 *   ROUTING_URL  default https://router.project-osrm.org (OSRM's public demo
 *                server: fine for MoorMove's volume today; swap it for a
 *                self-hosted or paid OSRM-compatible URL as deliveries grow).
 *                "off" never asks: every distance is an estimate.
 *
 *   ROUTING_TIMEOUT_MS   how long to wait for an answer (default 1500)
 *   ROUTING_COOLDOWN_MS  after the service fails (down, too slow, an error
 *                        answer), how long to leave it alone and estimate
 *                        straight away (default 180000: 3 minutes)
 *
 * When the route service is off, down, slow or finds no road, the distance
 * is an estimate: the straight line × the road factor (1.3 unless the
 * admin's settings say otherwise), marked source ESTIMATE. Answers are kept
 * in memory by both pins rounded to 4 decimals (about 11 m), and one
 * question per pair is asked at a time. A failing service trips a breaker:
 * for the cool-down every distance is an estimate at once, so a checkout
 * never waits on a service that is down. The settings are read on each call.
 */
const { haversineKm } = require('./geo');

const DEFAULT_URL = 'https://router.project-osrm.org';
const DEFAULT_TIMEOUT_MS = 1500;
const DEFAULT_COOLDOWN_MS = 3 * 60 * 1000;
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

const msSetting = (name, fallback, max) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};
const timeoutMs = () => msSetting('ROUTING_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, 10000);
const cooldownMs = () => msSetting('ROUTING_COOLDOWN_MS', DEFAULT_COOLDOWN_MS, 3600 * 1000);

// The breaker: while closedUntil is ahead, the route service is not asked.
const breaker = { url: null, closedUntil: 0, failures: 0 };
const serviceDown = (url) => breaker.url === url && Date.now() < breaker.closedUntil;
const tripped = (url) => {
  breaker.url = url;
  breaker.failures += 1;
  breaker.closedUntil = Date.now() + cooldownMs();
};
const healthy = (url) => {
  if (breaker.url === url) {
    breaker.closedUntil = 0;
    breaker.failures = 0;
  }
};

const round1 = (n) => Math.round(n * 10) / 10;

/** The straight line × the road factor, when the road can't be asked. */
const estimate = (a, b, factor = ROAD_FACTOR) => {
  const km = round1(haversineKm(a, b) * (Number(factor) > 0 ? Number(factor) : ROAD_FACTOR));
  return { km, minutes: Math.max(1, Math.round((km / ESTIMATE_KMH) * 60)), source: 'ESTIMATE' };
};

/**
 * OSRM's answer for a to b, or null (no road, an error, too slow). The
 * service itself failing (unreachable, too slow, a 5xx or 429) trips the
 * breaker; "no road between these pins" does not.
 */
const askRoute = async (url, a, b) => {
  try {
    const res = await fetch(
      `${url}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false&alternatives=false&steps=false`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs()) },
    );
    if (res.status >= 500 || res.status === 429) {
      tripped(url);
      return null;
    }
    healthy(url);
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
    tripped(url);
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
  // The service failed a moment ago: estimate now rather than wait on it again.
  if (serviceDown(url)) return estimate(a, b, roadFactor);

  const promise = (async () => {
    const road = await askRoute(url, a, b);
    const answer = road || estimate(a, b, roadFactor);
    remember(key, answer, road ? ROAD_TTL_MS : ESTIMATE_TTL_MS);
    return answer;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
};

/** Forget every answer and reset the breaker (tests). */
const clear = () => {
  cache.clear();
  breaker.url = null;
  breaker.closedUntil = 0;
  breaker.failures = 0;
};

/** For the admin: whether the route service is being skipped, and until when. */
const breakerState = () => ({
  url: routingUrl(),
  skipping: Boolean(breaker.url) && serviceDown(breaker.url),
  until: breaker.closedUntil > Date.now() ? new Date(breaker.closedUntil) : null,
  failures: breaker.failures,
});

module.exports = {
  roadDistance, estimate, routingUrl, clear, breakerState, DEFAULT_URL,
};
