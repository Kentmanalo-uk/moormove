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
    fee: jobs.num(job.fee),
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
 * What a delivery for an E-MOORM order would cost, and whether MoorMove can
 * take it: { available, reason, vehicleType, distanceKm, fee, town }.
 */
const quoteOrder = async ({ townId, packageSize, pickup, dropoff }, settings) => {
  const s = settings || await settingsLib.get();
  if (!jobs.SIZES.includes(packageSize)) throw new ApiError('Unknown package size', 422, { packageSize: 'SMALL, MEDIUM or LARGE' });
  if (!isPoint(pickup) || !isPoint(dropoff)) throw new ApiError('Both pins are needed', 422, { pin: 'Required' });
  const vehicleType = PARTNER_VEHICLE[packageSize];
  const price = quote(s, { vehicleType, packageSize, pickup: point(pickup), dropoff: point(dropoff) });
  const town = townId ? await prisma.town.findFirst({ where: { id: String(townId), isActive: true } }) : null;
  const answer = (reason) => ({
    available: !reason, reason: reason || null, vehicleType, distanceKm: price.distanceKm, fee: price.fee, town,
  });
  if (!s.partnerOpen || !s.bookingOpen) return answer('MoorMove is paused right now');
  if (!town || !town.serviceOpen) return answer(`MoorMove isn't open in ${town?.name || 'this town'} yet`);
  if (!inProvince(point(pickup)) || !inProvince(point(dropoff))) return answer('The pin is outside the area MoorMove serves');
  if (price.distanceKm > s.maxDistanceKm) return answer(`Too far for a rider (${price.distanceKm} km, up to ${s.maxDistanceKm} km)`);
  return answer(null);
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
  const townName = q.town.name;
  const pickup = readStop(b.pickup, 'pickup', errors, townName);
  const dropoff = readStop(b.dropoff, 'dropoff', errors, townName);
  const fee = round2(Number(b.fee));
  // The partner sets the fee (what the buyer paid), within reason.
  if (!Number.isFinite(fee) || fee <= 0 || fee > q.fee * 3) {
    errors.fee = `The fee must be more than ₱0 and at most ₱${q.fee * 3} (3 × MoorMove's ₱${q.fee})`;
  }
  const feePaidBy = ['SENDER', 'RECIPIENT'].includes(b.feePaidBy) ? b.feePaidBy : null;
  if (!feePaidBy) errors.feePaidBy = 'SENDER or RECIPIENT';
  const codAmount = round2(Number(b.codAmount) || 0);
  if (codAmount < 0 || codAmount > settings.maxCod) errors.codAmount = `COD can be up to ₱${settings.maxCod}`;
  failIf(errors);

  const externalCode = text(b.externalCode, 40) || null;
  const platformCut = round2((fee * settings.commissionPercent) / 100);
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
          fee,
          platformCut,
          riderEarning: round2(fee - platformCut),
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
