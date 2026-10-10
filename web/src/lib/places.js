/**
 * Barangays, from the public PSGC service (the same source and town codes
 * E-MOORM uses, copied from its web/src/lib/phAddress.js rather than imported
 * across apps). MoorMove's towns come from its own API; they are matched to
 * the PSGC codes below by name.
 */

export const PSGC_BASE = 'https://psgc.gitlab.io/api';

/** Oriental Mindoro's towns with their PSGC codes (Calapan is a city). */
export const SERVICE_MUNICIPALITIES = Object.freeze([
  { code: '175201000', name: 'Baco' },
  { code: '175202000', name: 'Bansud' },
  { code: '175203000', name: 'Bongabong' },
  { code: '175204000', name: 'Bulalacao' },
  { code: '175205000', name: 'Calapan City', isCity: true },
  { code: '175206000', name: 'Gloria' },
  { code: '175207000', name: 'Mansalay' },
  { code: '175208000', name: 'Naujan' },
  { code: '175209000', name: 'Pinamalayan' },
  { code: '175210000', name: 'Pola' },
  { code: '175211000', name: 'Puerto Galera' },
  { code: '175212000', name: 'Roxas' },
  { code: '175213000', name: 'San Teodoro' },
  { code: '175214000', name: 'Socorro' },
  { code: '175215000', name: 'Victoria' },
].map(Object.freeze));

/** A town name in one comparable form ("City of Calapan" and "Calapan City" are both "calapan"). */
export const normalizeName = (s) => (s || '')
  .toString()
  .toLowerCase()
  .replace(/\s+city$/i, '')
  .replace(/city of\s+/i, '')
  .replace(/[^a-z0-9]+/gi, '')
  .trim();

/** The PSGC town for one of MoorMove's towns (matched by name), or null. */
export const psgcTown = (townName) => {
  const target = normalizeName(townName);
  return SERVICE_MUNICIPALITIES.find((m) => normalizeName(m.name) === target) || null;
};

const cache = new Map();
const cachedFetch = async (url) => {
  if (cache.has(url)) return cache.get(url);
  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`PSGC ${res.status}`);
    return res.json();
  })();
  cache.set(url, promise);
  try {
    return await promise;
  } catch (err) {
    cache.delete(url);
    throw err;
  }
};

/**
 * A town's barangay names, A to Z. Tries the town's own kind first (cities
 * and municipalities live under different paths) and then the other.
 * Throws when PSGC can't be reached or doesn't know the town.
 */
export const listBarangays = async (townName) => {
  const town = psgcTown(townName);
  if (!town) throw new Error('Unknown town');
  const paths = town.isCity ? ['cities', 'municipalities'] : ['municipalities', 'cities'];
  let data = null;
  for (const kind of paths) {
    data = await cachedFetch(`${PSGC_BASE}/${kind}/${town.code}/barangays/`).catch(() => null);
    if (Array.isArray(data) && data.length) break;
  }
  if (!Array.isArray(data) || !data.length) throw new Error('No barangays');
  return [...new Set(data.map((b) => String(b.name).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
};

const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };
const SHORT = { sta: 'santa', sto: 'santo', pob: 'poblacion' };

/**
 * A barangay name in the server's comparable form (moormove/backend
 * lib/areas.js normBarangay): "Brgy. Sto. Niño" is "santo nino", "Barangay II
 * (Pob.)" is "2". Used to tick saved barangays in PSGC's list.
 */
export const normBarangay = (value) => {
  let s = String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  s = s.replace(/\(\s*(pob\.?|poblacion)\s*\)/g, ' ');
  const words = s.replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  while (words.length > 1 && ['barangay', 'brgy', 'bgy', 'brg'].includes(words[0])) words.shift();
  return words
    .map((w, i) => {
      if ((i > 0 || words.length === 1) && Object.hasOwn(ROMAN, w)) return ROMAN[w];
      return Object.hasOwn(SHORT, w) ? SHORT[w] : w;
    })
    .join(' ');
};
