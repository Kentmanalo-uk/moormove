/**
 * Where riders deliver. A rider picks whole towns, or single barangays of a
 * town (rider_areas). A rider who picked nothing delivers in their whole home
 * town, so riders from before this keep working.
 *
 * A place { townId, barangay } is in a rider's area when they have its whole
 * town, or that barangay (compared loosely: "Brgy. Sto. Niño" is "Santo
 * Nino"). A place with no barangay is only in a whole town. A job is offered
 * to a rider when both its pickup and its drop-off are in the rider's area.
 *
 * Every rule about areas lives here: the rider's job list, accepting, new-job
 * alerts, the admin's rider list and E-MOORM's quotes all use it.
 */
const prisma = require('./prisma');
const { ApiError } = require('../middleware/errors');
const { text } = require('./check');

const MAX_TOWNS = 15;
const MAX_ROWS = 300;
const MAX_BARANGAY = 80;

const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };
const SHORT = { sta: 'santa', sto: 'santo', pob: 'poblacion' };

/**
 * A barangay name in one comparable form: lower case, no accents, no
 * punctuation, single spaces, without a "Barangay"/"Brgy." prefix or a
 * "(Pob.)" note; "Pob." is "Poblacion", "Sta."/"Sto." are "Santa"/"Santo"
 * and Roman numerals are digits ("Barangay II (Pob.)" is "2").
 */
const normBarangay = (value) => {
  let s = String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  // "(Pob.)", "(Poblacion)": a note that it is in the town proper.
  s = s.replace(/\(\s*(pob\.?|poblacion)\s*\)/g, ' ');
  const words = s.replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  // The prefix only at the start, so "Poblacion" alone stays itself.
  while (words.length > 1 && ['barangay', 'brgy', 'bgy', 'brg'].includes(words[0])) words.shift();
  return words
    .map((w, i) => {
      if (i > 0 || words.length === 1) {
        if (Object.hasOwn(ROMAN, w)) return ROMAN[w];
      }
      return Object.hasOwn(SHORT, w) ? SHORT[w] : w;
    })
    .join(' ');
};

/** A barangay as saved and shown: trimmed, single spaces. */
const cleanBarangay = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * A rider's area as a lookup: Map(townId → { whole, barangays: Set }).
 * `rider.areas` must be loaded (rows with townId and barangay); with no rows
 * it is the rider's whole home town.
 */
const areaOf = (rider) => {
  const map = new Map();
  const rows = Array.isArray(rider?.areas) ? rider.areas : [];
  if (!rows.length) {
    if (rider?.townId) map.set(rider.townId, { whole: true, barangays: new Set() });
    return map;
  }
  for (const row of rows) {
    const entry = map.get(row.townId) || { whole: false, barangays: new Set() };
    if (row.barangay === null || row.barangay === undefined || row.barangay === '') entry.whole = true;
    else entry.barangays.add(normBarangay(row.barangay));
    map.set(row.townId, entry);
  }
  return map;
};

/** Is the place { townId, barangay } in this area (from areaOf)? */
const inArea = (area, place) => {
  const town = place?.townId ? area.get(String(place.townId)) : null;
  if (!town) return false;
  if (town.whole) return true;
  const b = normBarangay(place.barangay);
  return Boolean(b) && town.barangays.has(b);
};

/** Does the rider (with `areas` loaded) deliver to every one of `places`? */
const covers = (rider, ...places) => {
  const area = areaOf(rider);
  return places.every((p) => inArea(area, p));
};

/** A job's two ends, as places. */
const jobPlaces = (job) => [
  { townId: job.townId, barangay: job.pickupBarangay },
  { townId: job.dropoffTownId || job.townId, barangay: job.dropoffBarangay },
];

/** Is the job's pickup and drop-off both in the rider's area? */
const coversJob = (rider, job) => covers(rider, ...jobPlaces(job));

/** Prisma: riders who deliver in some part of a town. */
const inTownWhere = (townId) => ({
  OR: [
    { areas: { some: { townId: String(townId) } } },
    { areas: { none: {} }, townId: String(townId) },
  ],
});

/** Prisma: riders who deliver in some part of any of these towns (a first cut). */
const nearWhere = (townIds) => {
  const ids = [...new Set(townIds.filter(Boolean).map(String))];
  return {
    OR: [
      { areas: { some: { townId: { in: ids } } } },
      { areas: { none: {} }, townId: { in: ids } },
    ],
  };
};

/**
 * The riders matching `where` who deliver to all of `places`. Each comes with
 * its `areas` rows (and whatever `include` asks for).
 */
const ridersCovering = async (places, { where = {}, include = {}, orderBy } = {}) => {
  const riders = await prisma.rider.findMany({
    where: { AND: [where, nearWhere(places.map((p) => p.townId))] },
    include: { ...include, areas: { select: { townId: true, barangay: true } } },
    ...(orderBy ? { orderBy } : {}),
  });
  return riders.filter((r) => covers(r, ...places));
};

/** Prisma: jobs that may be in a rider's area (both ends in the rider's towns); check each with coversJob. */
const jobsNearWhere = (rider) => {
  const towns = [...areaOf(rider).keys()];
  return {
    townId: { in: towns },
    OR: [{ dropoffTownId: { in: towns } }, { dropoffTownId: null }],
  };
};

/* ── Showing an area ──────────────────────────────────────────────────── */

const byBarangay = (a, b) => {
  if (!a.barangay) return -1;
  if (!b.barangay) return 1;
  return a.barangay.localeCompare(b.barangay);
};

/** Area rows (with `town`) as the app shows them: [{ townId, townName, serviceOpen, barangay|null }], by town then barangay. */
const listAreas = (rows) => (rows || [])
  .map((r) => ({
    townId: r.townId,
    townName: r.town?.name || null,
    serviceOpen: r.town ? Boolean(r.town.serviceOpen) : null,
    barangay: r.barangay || null,
  }))
  .sort((a, b) => String(a.townName).localeCompare(String(b.townName)) || byBarangay(a, b));

/**
 * One line for lists: "Calapan City (whole town) · Baco (3 barangays)". The
 * rider (with `town` and `areas` with `town`): no rows is their home town.
 */
const summary = (rider) => {
  const rows = rider?.areas || [];
  if (!rows.length) return rider?.town?.name ? `${rider.town.name} (whole town)` : '';
  const towns = new Map();
  for (const r of rows) {
    const t = towns.get(r.townId) || { name: r.town?.name || 'A town', whole: false, barangays: [] };
    if (!r.barangay) t.whole = true;
    else t.barangays.push(r.barangay);
    towns.set(r.townId, t);
  }
  const home = rider.townId;
  return [...towns.entries()]
    .sort(([a, x], [b, y]) => (a === home ? -1 : b === home ? 1 : x.name.localeCompare(y.name)))
    .map(([, t]) => {
      if (t.whole) return `${t.name} (whole town)`;
      if (t.barangays.length === 1) return `${t.name} (${t.barangays[0]})`;
      return `${t.name} (${t.barangays.length} barangays)`;
    })
    .join(' · ');
};

/** A rider's areas include: each row with its town. */
const areasInclude = { areas: { include: { town: { select: { id: true, name: true, serviceOpen: true } } } } };

/** { homeTownId, usesHomeTown, areas, summary } for the rider and admin screens. */
const areaView = (rider) => ({
  homeTownId: rider.townId || null,
  // No places picked: they get their whole home town.
  usesHomeTown: !(rider.areas || []).length,
  areas: listAreas(rider.areas),
  summary: summary(rider),
});

/* ── Changing an area ─────────────────────────────────────────────────── */

/**
 * Check a new area: { areas: [{ townId, barangay|null }] }. Towns must be
 * active (closed ones are allowed, with a notice); a whole town swallows its
 * barangays; the same barangay twice (loosely) counts once. At most 15 towns
 * and 300 places.
 * @returns {Promise<{ rows: [{ townId, barangay }], notices: String[] }>}
 */
const readAreas = async (body) => {
  const list = body?.areas;
  if (!Array.isArray(list)) throw new ApiError('Send the places as a list', 422, { areas: 'A list of { townId, barangay }' });
  if (list.length > MAX_ROWS * 3) throw new ApiError(`Choose up to ${MAX_ROWS} places`, 422, { areas: 'Too many' });

  const errors = {};
  const wanted = [];
  list.forEach((item, i) => {
    const townId = typeof item?.townId === 'string' || typeof item?.townId === 'number' ? String(item.townId).trim() : '';
    if (!townId) {
      errors[`areas.${i}.townId`] = 'Choose a town';
      return;
    }
    const raw = item.barangay === null || item.barangay === undefined ? '' : (typeof item.barangay === 'string' ? item.barangay : null);
    if (raw === null) {
      errors[`areas.${i}.barangay`] = 'Type the barangay';
      return;
    }
    const barangay = cleanBarangay(raw);
    if (barangay.length > MAX_BARANGAY) {
      errors[`areas.${i}.barangay`] = `A barangay name is at most ${MAX_BARANGAY} characters`;
      return;
    }
    if (barangay && !normBarangay(barangay)) {
      errors[`areas.${i}.barangay`] = 'Type the barangay';
      return;
    }
    wanted.push({ townId, barangay: barangay || null });
  });

  const ids = [...new Set(wanted.map((w) => w.townId))];
  const towns = ids.length
    ? await prisma.town.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, isActive: true, serviceOpen: true } })
    : [];
  const byId = new Map(towns.map((t) => [t.id, t]));
  for (const id of ids) {
    const town = byId.get(id);
    if (!town || !town.isActive) errors.areas = errors.areas || 'Choose towns from the list';
  }
  if (Object.keys(errors).length) throw new ApiError(Object.values(errors)[0], 422, errors);

  // A whole town covers its barangays; a barangay twice counts once.
  const whole = new Set(wanted.filter((w) => !w.barangay).map((w) => w.townId));
  const seen = new Set();
  const rows = [];
  for (const w of wanted) {
    const key = w.barangay ? `${w.townId}|${normBarangay(w.barangay)}` : `${w.townId}|*`;
    if (seen.has(key) || (w.barangay && whole.has(w.townId))) continue;
    seen.add(key);
    rows.push(w);
  }

  const townCount = new Set(rows.map((r) => r.townId)).size;
  if (townCount > MAX_TOWNS) throw new ApiError(`Choose up to ${MAX_TOWNS} towns`, 422, { areas: `Up to ${MAX_TOWNS} towns` });
  if (rows.length > MAX_ROWS) throw new ApiError(`Choose up to ${MAX_ROWS} places`, 422, { areas: `Up to ${MAX_ROWS} places` });

  const closed = [...new Set(rows.map((r) => r.townId))].map((id) => byId.get(id)).filter((t) => !t.serviceOpen);
  const notices = closed.map((t) => `MoorMove isn't open in ${t.name} yet. You'll get its deliveries once it opens.`);
  return { rows, notices };
};

/** Replace the rider's whole area with `rows` (from readAreas). */
const saveAreas = async (riderId, rows) => {
  try {
    await prisma.$transaction([
      prisma.riderArea.deleteMany({ where: { riderId } }),
      ...(rows.length ? [prisma.riderArea.createMany({ data: rows.map((r) => ({ riderId, townId: r.townId, barangay: r.barangay })) })] : []),
    ]);
  } catch (err) {
    // Two spellings the database counts as one (e.g. "Ñ" and "N").
    if (err.code === 'P2002') throw new ApiError('A barangay is in the list twice', 422, { areas: 'Listed twice' });
    throw err;
  }
};

/* ── Counting ─────────────────────────────────────────────────────────── */

/**
 * Per town: how many approved riders deliver in some part of it, and how
 * many of them are online. Map(townId → { approved, online }).
 */
const townCounts = async () => {
  const riders = await prisma.rider.findMany({
    where: { status: 'APPROVED', user: { isActive: true } },
    select: { townId: true, isOnline: true, areas: { select: { townId: true } } },
  });
  const counts = new Map();
  for (const r of riders) {
    const towns = r.areas.length ? new Set(r.areas.map((a) => a.townId)) : new Set(r.townId ? [r.townId] : []);
    for (const t of towns) {
      const c = counts.get(t) || { approved: 0, online: 0 };
      c.approved += 1;
      if (r.isOnline) c.online += 1;
      counts.set(t, c);
    }
  }
  return counts;
};

/** "Lalud, Calapan City", or just the town when the barangay isn't known. */
const placeName = (barangay, townName) => [text(barangay, MAX_BARANGAY), townName].filter(Boolean).join(', ');

module.exports = {
  MAX_TOWNS,
  MAX_ROWS,
  MAX_BARANGAY,
  normBarangay,
  areaOf,
  inArea,
  covers,
  coversJob,
  jobPlaces,
  inTownWhere,
  nearWhere,
  jobsNearWhere,
  ridersCovering,
  areasInclude,
  listAreas,
  summary,
  areaView,
  readAreas,
  saveAreas,
  townCounts,
  placeName,
};
