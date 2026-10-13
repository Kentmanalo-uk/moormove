/**
 * E-MOORM as a partner: its shops send orders to MoorMove's riders. E-MOORM
 * talks to MoorMove server to server with one shared secret; sellers and
 * buyers never sign in here.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('./prisma');
const settingsLib = require('./settings');
const { quote } = require('./fare');
const { inProvince, isPoint } = require('./geo');
const { text, failIf } = require('./check');
const { ApiError } = require('../middleware/errors');
const jobs = require('./jobs');
const areas = require('./areas');
const promos = require('./promos');

// The account E-MOORM jobs are "created by". It can never sign in.
const SYSTEM_EMAIL = 'partner@emoorm.system';

// The cheapest vehicle that carries each size (bicycles are left out): the
// fare is set with it, but any rider whose vehicle carries the size may take
// the job.
const PARTNER_VEHICLE = { SMALL: 'MOTORCYCLE', MEDIUM: 'MOTORCYCLE', LARGE: 'TRICYCLE' };

const round2 = (n) => Math.round(n * 100) / 100;

let systemUserId = null;
const systemUser = async () => {
  if (systemUserId) return systemUserId;
  const found = await prisma.user.findUnique({ where: { email: SYSTEM_EMAIL }, select: { id: true } });
  if (found) {
    systemUserId = found.id;
    return systemUserId;
  }
  try {
    const user = await prisma.user.create({
      data: {
        email: SYSTEM_EMAIL,
        fullName: 'E-MOORM',
        phone: '00000000000',
        role: 'CUSTOMER',
        isActive: false,
        // A hash of a random password nobody knows.
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
      },
    });
    systemUserId = user.id;
  } catch (err) {
    if (err.code !== 'P2002') throw err;
    systemUserId = (await prisma.user.findUnique({ where: { email: SYSTEM_EMAIL } })).id;
  }
  return systemUserId;
};

/** A job as E-MOORM sees it (the same shape in answers and in updates). */
const partnerView = async (job) => {
  const r = job.rider ? await jobs.riderSummary(job.rider) : null;
  return {
    id: job.id,
    code: job.code,
    externalRef: job.externalRef,
    externalCode: job.externalCode,
    status: job.status,
    vehicleType: job.vehicleType,
    packageSize: job.packageSize,
    distanceKm: jobs.num(job.distanceKm),
    // ROAD (by road) or ESTIMATE (the route service was out); null: an older job.
    distanceSource: job.distanceSource || null,
    fee: jobs.num(job.fee),
    // A free-delivery promo: fee 0, listFee the usual fee, and the rider's
    // earning is paid by MoorMove (the shop pays the rider nothing).
    listFee: jobs.num(job.listFee),
    promo: job.promo ? { id: job.promo.id, title: job.promo.title } : null,
    riderEarning: jobs.num(job.riderEarning),
    feePaidBy: job.feePaidBy,
    codAmount: jobs.num(job.codAmount),
    codReturnedAt: job.codReturnedAt,
    pickupPhotoId: job.pickupPhotoId,
    deliveryPhotoId: job.deliveryPhotoId,
    acceptedAt: job.acceptedAt,
    arrivedPickupAt: job.arrivedPickupAt,
    pickedUpAt: job.pickedUpAt,
    arrivedDropoffAt: job.arrivedDropoffAt,
    deliveredAt: job.deliveredAt,
    cancelledAt: job.cancelledAt,
    cancelReason: job.cancelReason,
    failedAt: job.failedAt,
    failReason: job.failReason,
    // Why it failed (lib/failReasons.js: BUYER_REFUSED, BUYER_UNREACHABLE,
    // WRONG_ADDRESS, PARCEL_DAMAGED, WRONG_ITEM, RIDER_PROBLEM, OTHER; null on
    // older jobs), whether it was the buyer's fault, and whether the rider is
    // paid for the failed trip (set once the parcel is back).
    failCode: job.failCode || null,
    buyerFault: Boolean(job.buyerFault),
    failPaid: Boolean(job.failPaid),
    // A failed delivery's parcel: RETURNING while the rider brings it back,
    // returnedAt once the shop (or MoorMove's staff) confirmed it is back.
    returnedAt: job.returnedAt || null,
    updatedAt: job.updatedAt,
    rider: r && {
      name: r.name,
      phone: r.phone,
      vehicleType: r.vehicleType,
      plateNumber: r.plateNumber,
      todaName: r.todaName,
      rating: r.rating,
      deliveries: r.deliveries,
      lat: r.lat,
      lng: r.lng,
      lastSeenAt: r.lastSeenAt,
    },
  };
};

const point = (p) => ({ lat: Number(p.lat), lng: Number(p.lng) });

/**
 * Which approved riders' areas hold a pickup and a drop-off place. When none
 * holds both, the place to name: the one nobody delivers to (the drop-off
 * when each is covered by someone, but never by the same rider).
 */
const uncoveredPlace = async (pickupPlace, dropoffPlace) => {
  const where = { status: 'APPROVED', user: { isActive: true } };
  const atPickup = await areas.ridersCovering([pickupPlace], { where });
  if (atPickup.some((r) => areas.covers(r, dropoffPlace))) return null;
  if (!atPickup.length && (await areas.ridersCovering([dropoffPlace], { where })).length) return pickupPlace;
  return dropoffPlace;
};

/**
 * What a delivery for an E-MOORM order would cost, and whether MoorMove can
 * take it: { available, reason, vehicleType, distanceKm, distanceSource, minutes, fee, town, dropoffTown }.
 * Optional: dropoffTownId (the buyer's town; default the pickup's) and
 * pickup.barangay / dropoff.barangay. Without a rider whose area has both
 * ends it is unavailable ("No MoorMove rider delivers to Lalud, Calapan City
 * yet"); being online doesn't matter here.
 */
const quoteOrder = async ({ townId, dropoffTownId, packageSize, pickup, dropoff }, settings) => {
  const s = settings || await settingsLib.get();
  if (!jobs.SIZES.includes(packageSize)) throw new ApiError('Unknown package size', 422, { packageSize: 'SMALL, MEDIUM or LARGE' });
  if (!isPoint(pickup) || !isPoint(dropoff)) throw new ApiError('Both pins are needed', 422, { pin: 'Required' });
  const vehicleType = PARTNER_VEHICLE[packageSize];
  // By road from the shop's pin to the buyer's (an ESTIMATE when the route service is out).
  const price = await quote(s, { vehicleType, packageSize, pickup: point(pickup), dropoff: point(dropoff) });
  const town = townId ? await prisma.town.findFirst({ where: { id: String(townId), isActive: true } }) : null;
  const sameTown = !dropoffTownId || String(dropoffTownId) === String(townId);
  const dropoffTown = sameTown ? town : await prisma.town.findFirst({ where: { id: String(dropoffTownId), isActive: true } });
  const answer = (reason, promo = null) => ({
    available: !reason,
    reason: reason || null,
    vehicleType,
    distanceKm: price.distanceKm,
    // ROAD (km by road) or ESTIMATE (straight line × the road factor).
    distanceSource: price.distanceSource,
    // The ride from the shop to the buyer, in minutes (by road, or at town speed).
    minutes: Number.isFinite(price.minutes) ? price.minutes : null,
    // A free-delivery promo: the buyer pays nothing; listFee is the usual fee.
    fee: promo ? 0 : price.fee,
    listFee: price.fee,
    promo: promos.brief(promo),
    town,
    dropoffTown,
  });
  if (!s.partnerOpen || !s.bookingOpen) return answer('MoorMove is paused right now');
  if (!town || !town.serviceOpen) return answer(`MoorMove isn't open in ${town?.name || 'this town'} yet`);
  if (!dropoffTown || !dropoffTown.serviceOpen) return answer(`MoorMove isn't open in ${dropoffTown?.name || "the buyer's town"} yet`);
  if (!inProvince(point(pickup)) || !inProvince(point(dropoff))) return answer('The pin is outside the area MoorMove serves');
  if (price.distanceKm > s.maxDistanceKm) return answer(`Too far for a rider (${price.distanceKm} km, up to ${s.maxDistanceKm} km)`);
  const missing = await uncoveredPlace(
    { townId: town.id, barangay: text(pickup?.barangay, 80) || null },
    { townId: dropoffTown.id, barangay: text(dropoff?.barangay, 80) || null },
  );
  if (missing) {
    const name = areas.placeName(missing.barangay, missing.townId === town.id ? town.name : dropoffTown.name);
    return answer(`No MoorMove rider delivers to ${name} yet`);
  }
  return answer(null, await promos.applicable({ townId: town.id, distanceKm: price.distanceKm }));
};

// Partners send the phone numbers they have: keep digits and a leading +.
const looseIsPhone = (value) => /^\+?\d{7,15}$/.test(value);
const loosePhone = (value) => text(value, 24).replace(/[\s\-().]/g, '');

const readStop = (s, key, errors, fallbackBarangay) => {
  const v = s || {};
  const out = {
    name: text(v.name, 120),
    phone: loosePhone(v.phone),
    address: text(v.address, 255),
    barangay: text(v.barangay, 80) || fallbackBarangay,
    notes: text(v.notes, 255) || null,
    lat: Number(v.lat),
    lng: Number(v.lng),
  };
  if (out.name.length < 2) errors[`${key}.name`] = 'A name is needed';
  if (!looseIsPhone(out.phone)) errors[`${key}.phone`] = 'A phone number is needed';
  if (out.address.length < 3) errors[`${key}.address`] = 'An address is needed';
  if (!isPoint(v) || !inProvince(out)) errors[`${key}.pin`] = 'A pin in Oriental Mindoro is needed';
  return out;
};

const findOpen = (externalRef) => prisma.job.findUnique({ where: { openRef: externalRef }, include: jobs.jobInclude });

/**
 * A job for an E-MOORM order. If the order already has an open job, that
 * one comes back instead: { job, created }.
 */
const createOrderJob = async (body) => {
  const b = body || {};
  const externalRef = text(b.externalRef, 64);
  if (!externalRef) throw new ApiError('externalRef (the order id) is needed', 422, { externalRef: 'Required' });
  const existing = await findOpen(externalRef);
  if (existing) return { job: existing, created: false };

  const settings = await settingsLib.get();
  const q = await quoteOrder(b, settings);
  if (!q.available) {
    throw new ApiError(q.reason, q.reason === 'MoorMove is paused right now' ? 503 : 422);
  }
  const errors = {};
  const pickup = readStop(b.pickup, 'pickup', errors, q.town.name);
  const dropoff = readStop(b.dropoff, 'dropoff', errors, q.dropoffTown.name);
  const fee = round2(Number(b.fee));
  const usual = q.listFee;
  // A free delivery: the buyer was charged nothing at checkout under a promo
  // that ran in the last 7 days (it may have ended since).
  const promo = fee === 0 ? await promos.honourable(b.promoId) : null;
  if (fee === 0 && !promo) {
    errors.fee = b.promoId
      ? "That promo isn't running, so the delivery can't be free"
      : 'A free delivery needs the promoId of a MoorMove promo';
  } else if (!promo && (!Number.isFinite(fee) || fee <= 0 || fee > usual * 3)) {
    // The partner sets the fee (what the buyer paid), within reason.
    errors.fee = `The fee must be more than ₱0 and at most ₱${usual * 3} (3 × MoorMove's ₱${usual})`;
  }
  const feePaidBy = ['SENDER', 'RECIPIENT'].includes(b.feePaidBy) ? b.feePaidBy : null;
  if (!feePaidBy) errors.feePaidBy = 'SENDER or RECIPIENT';
  const codAmount = round2(Number(b.codAmount) || 0);
  if (codAmount < 0 || codAmount > settings.maxCod) errors.codAmount = `COD can be up to ₱${settings.maxCod}`;
  failIf(errors);

  const externalCode = text(b.externalCode, 40) || null;
  const platformCut = round2((fee * settings.commissionPercent) / 100);
  // A free delivery: the rider earns as usual and MoorMove pays it (platformCut below zero).
  const money = promo
    ? { ...promos.freeMoney(usual, settings), promoId: promo.id }
    : { fee, platformCut, riderEarning: round2(fee - platformCut) };
  const createdById = await systemUser();
  let job;
  for (let attempt = 0; !job; attempt += 1) {
    try {
      job = await prisma.job.create({
        data: {
          code: jobs.newCode(),
          source: 'EMOORM',
          externalRef,
          externalCode,
          openRef: externalRef,
          customerId: null,
          createdById,
          townId: q.town.id,
          dropoffTownId: q.dropoffTown.id,
          vehicleType: q.vehicleType,
          pickupName: pickup.name,
          pickupPhone: pickup.phone,
          pickupAddress: pickup.address,
          pickupBarangay: pickup.barangay,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          pickupNotes: pickup.notes,
          dropoffName: dropoff.name,
          dropoffPhone: dropoff.phone,
          dropoffAddress: dropoff.address,
          dropoffBarangay: dropoff.barangay,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          dropoffNotes: dropoff.notes,
          packageSize: b.packageSize,
          packageDetails: text(b.packageDetails, 255) || `E-MOORM order${externalCode ? ` #${externalCode}` : ''}`,
          distanceKm: q.distanceKm,
          distanceSource: q.distanceSource,
          ...money,
          feePaidBy,
          codAmount,
          events: { create: { status: 'SEARCHING', actorId: createdById, note: `E-MOORM order${externalCode ? ` #${externalCode}` : ''}` } },
        },
        include: jobs.jobInclude,
      });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
      // The same order sent twice at once: the other request made the job.
      const target = String(err.meta?.target || '');
      if (target.includes('open_ref')) {
        const other = await findOpen(externalRef);
        if (other) return { job: other, created: false };
      }
      if (attempt > 4) throw err;
    }
  }
  await jobs.alertRiders(job);
  return { job, created: true };
};

/** An E-MOORM job by id (E-MOORM sees only its own jobs). */
const findOrderJob = async (id) => {
  const job = await prisma.job.findUnique({ where: { id: String(id) }, include: jobs.jobInclude });
  if (!job || job.source !== 'EMOORM') throw new ApiError('Delivery not found', 404);
  return job;
};

module.exports = { SYSTEM_EMAIL, PARTNER_VEHICLE, systemUser, partnerView, quoteOrder, createOrderJob, findOrderJob };
