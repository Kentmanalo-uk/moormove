/**
 * Free-delivery promos, set by MoorMove's admin. While one runs, a delivery
 * picked up in its towns (and no longer than its maxKm) costs the buyer
 * nothing: the job's fee is 0 and listFee keeps the usual fee. The rider
 * still earns their usual share of the usual fee, paid by MoorMove: the
 * job's platformCut is minus that earning, so the cash the rider owes
 * MoorMove (the sum of platformCut) goes down, or below zero when MoorMove
 * owes the rider.
 */
const prisma = require('./prisma');
const { ApiError } = require('../middleware/errors');
const { text } = require('./check');
const { notify } = require('./notify');
const areas = require('./areas');

// A promo booked at checkout is honoured this long after it ends (or was
// switched off), so what the buyer was charged still holds when the shop
// calls the rider.
const HONOUR_MS = 7 * 24 * 3600 * 1000;
const MIN_KM = 0.5;
const MAX_KM = 30;

const round2 = (n) => Math.round(n * 100) / 100;
const num = (d) => (d === null || d === undefined ? null : Number(d));

/** The pickup town ids it applies in, or null for all towns. */
const townIdsOf = (promo) => (Array.isArray(promo?.townIds) && promo.townIds.length ? promo.townIds.map(String) : null);

/** Running at `at`: switched on and started, not yet ended. */
const isRunning = (promo, at = new Date()) => Boolean(promo)
  && promo.active
  && promo.startsAt <= at
  && (!promo.endsAt || promo.endsAt > at);

/** SCHEDULED | ON | ENDED | OFF, for the admin's list. */
const stateOf = (promo, at = new Date()) => {
  if (promo.endsAt && promo.endsAt <= at) return 'ENDED';
  if (!promo.active) return 'OFF';
  if (promo.startsAt > at) return 'SCHEDULED';
  return 'ON';
};

/** Does it apply to a delivery picked up in townId, distanceKm long? */
const fits = (promo, { townId, distanceKm }) => {
  const towns = townIdsOf(promo);
  if (towns && !(townId && towns.includes(String(townId)))) return false;
  const max = num(promo.maxKm);
  return max === null || (Number.isFinite(Number(distanceKm)) && Number(distanceKm) <= max);
};

const runningWhere = (at = new Date()) => ({
  active: true,
  startsAt: { lte: at },
  OR: [{ endsAt: null }, { endsAt: { gt: at } }],
});

/** The promos running now, newest first. */
const runningNow = () => prisma.promo.findMany({ where: runningWhere(), orderBy: { createdAt: 'desc' } });

/** The newest running promo for a delivery picked up in townId, distanceKm long, or null. */
const applicable = async ({ townId, distanceKm }) => (await runningNow()).find((p) => fits(p, { townId, distanceKm })) || null;

/**
 * A promo the partner may still book a free delivery on: it exists, started,
 * and ran at some time in the last 7 days.
 */
const honourable = async (promoId) => {
  if (!promoId) return null;
  const promo = await prisma.promo.findUnique({ where: { id: String(promoId) } });
  if (!promo) return null;
  const now = new Date();
  if (promo.startsAt > now) return null;
  // When it stopped: its end, or when it was switched off (its last change).
  const ends = [promo.endsAt, promo.active ? null : promo.updatedAt].filter(Boolean);
  const stopped = ends.length ? new Date(Math.min(...ends.map((d) => d.getTime()))) : null;
  if (stopped && stopped.getTime() <= now.getTime() - HONOUR_MS) return null;
  return promo;
};

/**
 * A free delivery's money, from the usual fee: { fee: 0, listFee,
 * riderEarning (as usual), platformCut (minus it: MoorMove pays) }.
 */
const freeMoney = (listFee, settings) => {
  const riderEarning = round2(listFee - (listFee * settings.commissionPercent) / 100);
  return { fee: 0, listFee: round2(listFee), riderEarning, platformCut: -riderEarning };
};

/** { id, title, endsAt } for quotes; null when none. */
const brief = (promo) => (promo ? { id: promo.id, title: promo.title, endsAt: promo.endsAt } : null);

/** The full promo as the admin and the partner see it. */
const view = (promo, extra = {}) => ({
  id: promo.id,
  title: promo.title,
  note: promo.note,
  active: promo.active,
  startsAt: promo.startsAt,
  endsAt: promo.endsAt,
  townIds: townIdsOf(promo),
  maxKm: num(promo.maxKm),
  state: stateOf(promo),
  createdAt: promo.createdAt,
  updatedAt: promo.updatedAt,
  ...extra,
});

/**
 * Who a balance is owed by: the sum of platformCut is positive when the rider
 * owes MoorMove, negative when MoorMove owes the rider.
 * @returns {{ owed: Number, direction: 'RIDER_OWES'|'MOORMOVE_OWES'|'SETTLED', amount: Number }}
 */
const balance = (sum) => {
  const owed = round2(Number(sum) || 0);
  return {
    owed,
    direction: owed > 0 ? 'RIDER_OWES' : owed < 0 ? 'MOORMOVE_OWES' : 'SETTLED',
    amount: Math.abs(owed),
  };
};

/* ── The admin's form ─────────────────────────────────────────────────── */

const readDate = (value, key, errors, label) => {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    errors[key] = `Enter the ${label} as a date and time`;
    return null;
  }
  return d;
};

/**
 * Check the admin's promo form. `current` is the promo being edited (fields
 * not sent keep their value).
 * @returns {Promise<Object>} data for prisma
 */
const readForm = async (body, current = null) => {
  const b = body || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const errors = {};
  const data = {};

  if (!current || has('title')) {
    data.title = text(b.title, 200);
    if (!data.title) errors.title = 'Give the promo a title, like "Free delivery week"';
    else if (data.title.length > 80) errors.title = 'Keep the title to 80 characters';
  }
  if (has('note')) {
    data.note = text(b.note, 1000) || null;
    if (data.note && data.note.length > 255) errors.note = 'Keep the note to 255 characters';
  }
  if (has('active')) {
    if (typeof b.active !== 'boolean') errors.active = 'Say whether the promo is on';
    else data.active = b.active;
  }
  if (!current || has('startsAt')) {
    data.startsAt = readDate(b.startsAt, 'startsAt', errors, 'start') || (current && !has('startsAt') ? current.startsAt : new Date());
  }
  if (has('endsAt')) data.endsAt = readDate(b.endsAt, 'endsAt', errors, 'end');
  const startsAt = data.startsAt || current?.startsAt;
  const endsAt = has('endsAt') ? data.endsAt : current?.endsAt;
  if (!errors.startsAt && !errors.endsAt && endsAt && startsAt && endsAt <= startsAt) {
    errors.endsAt = 'The promo must end after it starts';
  }
  if (has('townIds')) {
    if (b.townIds === null || (Array.isArray(b.townIds) && b.townIds.length === 0)) {
      data.townIds = null;
    } else if (!Array.isArray(b.townIds) || b.townIds.some((t) => typeof t !== 'string' || !t.trim())) {
      errors.townIds = 'Choose the towns from the list, or all towns';
    } else {
      const ids = [...new Set(b.townIds.map((t) => t.trim()))];
      const found = await prisma.town.count({ where: { id: { in: ids }, isActive: true } });
      if (found !== ids.length) errors.townIds = 'Choose the towns from the list, or all towns';
      else data.townIds = ids;
    }
  }
  if (has('maxKm')) {
    if (b.maxKm === null || b.maxKm === '') {
      data.maxKm = null;
    } else {
      const km = Number(b.maxKm);
      if (!Number.isFinite(km) || km < MIN_KM || km > MAX_KM) errors.maxKm = `Set the longest delivery from ${MIN_KM} to ${MAX_KM} km, or leave it empty for any`;
      else data.maxKm = round2(km);
    }
  }
  if (Object.keys(errors).length) throw new ApiError(Object.values(errors)[0], 422, errors);
  return data;
};

/**
 * Tell approved riders who deliver in the promo's towns (all riders when it
 * is for all towns) that deliveries are free for buyers and MoorMove pays
 * them as usual.
 */
const tellRiders = async (promo) => {
  const towns = townIdsOf(promo);
  const riders = await prisma.rider.findMany({
    where: { status: 'APPROVED', user: { isActive: true }, ...(towns ? areas.nearWhere(towns) : {}) },
    select: { userId: true },
  });
  const starts = promo.startsAt > new Date()
    ? ` From ${promo.startsAt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}.`
    : '';
  await notify(riders.map((r) => r.userId), {
    kind: 'promo',
    title: `Free delivery: ${promo.title}`,
    body: `Buyers pay no delivery fee; MoorMove pays your usual earning.${starts}${promo.note ? ` ${promo.note}` : ''}`,
    link: '/rider',
  });
  return riders.length;
};

module.exports = {
  HONOUR_MS,
  MIN_KM,
  MAX_KM,
  townIdsOf,
  isRunning,
  stateOf,
  fits,
  runningNow,
  applicable,
  honourable,
  freeMoney,
  brief,
  view,
  balance,
  readForm,
  tellRiders,
};
