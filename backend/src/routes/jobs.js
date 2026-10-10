/**
 * Deliveries, from the customer's side (and the one detail page everyone
 * involved shares).
 */
const express = require('express');
const prisma = require('../lib/prisma');
const settingsLib = require('../lib/settings');
const { quote, carries } = require('../lib/fare');
const { isPoint } = require('../lib/geo');
const { authenticate, allow } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');
const { text } = require('../lib/check');
const { notify } = require('../lib/notify');
const jobs = require('../lib/jobs');
const areas = require('../lib/areas');
const promos = require('../lib/promos');

const router = express.Router();
router.use(authenticate);

const CLOSED = "MoorMove isn't open to customers yet";

/** Customers book only while MoorMove takes bookings from the public. */
const customersWelcome = async (req) => {
  if (req.user.role !== 'CUSTOMER') return;
  const s = await settingsLib.get();
  if (!s.publicBooking) throw new ApiError(CLOSED, 403);
};

/** Fares and rules the booking form needs. */
router.get('/rules', async (req, res) => {
  const s = await settingsLib.get();
  res.json({
    success: true,
    data: {
      vehicles: s.vehicles,
      includedKm: s.includedKm,
      sizeSurcharge: s.sizeSurcharge,
      maxDistanceKm: s.maxDistanceKm,
      maxCod: s.maxCod,
      bookingOpen: s.bookingOpen,
      // Customers: false while MoorMove carries E-MOORM orders only.
      publicBooking: req.user.role !== 'CUSTOMER' || Boolean(s.publicBooking),
      supportPhone: s.supportPhone,
      supportEmail: s.supportEmail,
      carries: settingsLib.CARRIES,
    },
  });
});

/** How many riders who deliver in a town are online right now, per vehicle. Counts only. */
router.get('/riders-online', async (req, res) => {
  const townId = String(req.query.townId || '');
  const rows = await prisma.rider.groupBy({
    by: ['vehicleType'],
    where: { status: 'APPROVED', isOnline: true, ...(townId ? areas.inTownWhere(townId) : {}) },
    _count: { _all: true },
  });
  const counts = { TRICYCLE: 0, MOTORCYCLE: 0, BICYCLE: 0 };
  for (const r of rows) if (r.vehicleType) counts[r.vehicleType] = r._count._all;
  res.json({ success: true, data: { ...counts, total: counts.TRICYCLE + counts.MOTORCYCLE + counts.BICYCLE } });
});

/**
 * What a delivery would cost (the price shown before booking). With the
 * pickup's townId, a free-delivery promo running there makes it fee 0, with
 * listFee (the usual fee) and promo { id, title, endsAt }.
 */
router.post('/quote', async (req, res) => {
  await customersWelcome(req);
  const { vehicleType, packageSize, pickup, dropoff, townId } = req.body || {};
  if (!jobs.VEHICLES.includes(vehicleType) || !jobs.SIZES.includes(packageSize) || !isPoint(pickup) || !isPoint(dropoff)) {
    throw new ApiError('Drop both pins and choose a vehicle and size', 422);
  }
  const s = await settingsLib.get();
  // By road (an ESTIMATE when the route service is out).
  const price = await quote(s, {
    vehicleType, packageSize,
    pickup: { lat: Number(pickup.lat), lng: Number(pickup.lng) },
    dropoff: { lat: Number(dropoff.lat), lng: Number(dropoff.lng) },
  });
  const promo = await promos.applicable({ townId: townId ? String(townId) : null, distanceKm: price.distanceKm });
  res.json({
    success: true,
    data: {
      distanceKm: price.distanceKm,
      distanceSource: price.distanceSource,
      fee: promo ? 0 : price.fee,
      listFee: price.fee,
      promo: promos.brief(promo),
      breakdown: price.breakdown,
      fits: carries(vehicleType, packageSize),
      tooFar: price.distanceKm > s.maxDistanceKm,
    },
  });
});

router.post('/', allow('CUSTOMER'), async (req, res) => {
  await customersWelcome(req);
  const job = await jobs.createJob({ body: req.body, createdById: req.user.id, customerId: req.user.id });
  res.status(201).json({ success: true, data: { id: job.id, code: job.code } });
});

const TABS = {
  ongoing: { status: { in: jobs.OPEN } },
  completed: { status: 'DELIVERED' },
  cancelled: { status: { in: ['CANCELLED', 'FAILED'] } },
};

/** The customer's deliveries: ?tab=ongoing|completed|cancelled. */
router.get('/', allow('CUSTOMER'), async (req, res) => {
  const tab = TABS[req.query.tab] ? req.query.tab : 'ongoing';
  const rows = await prisma.job.findMany({
    where: { customerId: req.user.id, ...TABS[tab] },
    include: { rider: { include: { user: { select: { fullName: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const counts = Object.fromEntries(await Promise.all(Object.entries(TABS).map(async ([k, where]) => [
    k, await prisma.job.count({ where: { customerId: req.user.id, ...where } }),
  ])));
  res.json({
    success: true,
    data: {
      counts,
      jobs: rows.map((j) => ({
        id: j.id, code: j.code, status: j.status, vehicleType: j.vehicleType,
        pickupBarangay: j.pickupBarangay, dropoffBarangay: j.dropoffBarangay,
        pickupAddress: j.pickupAddress, dropoffAddress: j.dropoffAddress, dropoffName: j.dropoffName,
        packageDetails: j.packageDetails, fee: Number(j.fee), codAmount: Number(j.codAmount),
        // Free under a promo: fee 0, listFee the usual fee.
        listFee: j.listFee === null ? null : Number(j.listFee), promoId: j.promoId,
        riderName: j.rider?.user?.fullName || null, rating: j.rating,
        createdAt: j.createdAt, deliveredAt: j.deliveredAt,
      })),
    },
  });
});

/** Recent pickup and drop-off places, to fill the form in one tap. */
router.get('/places', allow('CUSTOMER'), async (req, res) => {
  const rows = await prisma.job.findMany({
    where: { customerId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const seen = new Set();
  const places = [];
  for (const j of rows) {
    for (const side of ['pickup', 'dropoff']) {
      const p = {
        townId: j.townId,
        name: j[`${side}Name`], phone: j[`${side}Phone`], address: j[`${side}Address`],
        barangay: j[`${side}Barangay`], lat: j[`${side}Lat`], lng: j[`${side}Lng`], notes: j[`${side}Notes`],
      };
      const key = `${p.name}|${p.address}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        places.push(p);
      }
    }
  }
  res.json({ success: true, data: places.slice(0, 8) });
});

router.get('/:id', async (req, res) => {
  const job = await jobs.findForViewer(req.params.id, req.user);
  res.json({ success: true, data: await jobs.jobView(job, req.user) });
});

const mine = async (id, user) => {
  const job = await prisma.job.findUnique({ where: { id: String(id) }, include: jobs.jobInclude });
  if (!job || job.customerId !== user.id) throw new ApiError('Delivery not found', 404);
  return job;
};

/** Until the rider has the package. */
router.post('/:id/cancel', allow('CUSTOMER'), async (req, res) => {
  const job = await mine(req.params.id, req.user);
  const reason = text(req.body?.reason, 255) || 'Cancelled by the customer';
  const updated = await jobs.move(job, {
    from: ['SEARCHING', 'ACCEPTED', 'AT_PICKUP'],
    to: 'CANCELLED',
    data: { cancelledAt: new Date(), cancelReason: reason },
    actorId: req.user.id,
    note: reason,
    conflict: 'The rider already has the package, so it can no longer be cancelled. Contact support if you need help.',
  });
  if (job.rider) {
    await notify(job.rider.userId, {
      kind: 'job', title: `Delivery ${job.code} was cancelled`, body: `The customer cancelled: ${reason}`, link: `/rider/jobs/${job.id}`,
    });
  }
  res.json({ success: true, data: await jobs.jobView(updated, req.user) });
});

router.post('/:id/rate', allow('CUSTOMER'), async (req, res) => {
  const job = await mine(req.params.id, req.user);
  const stars = Number(req.body?.rating);
  if (job.status !== 'DELIVERED') throw new ApiError('You can rate once it is delivered', 409);
  if (job.rating) throw new ApiError('You already rated this delivery', 409);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new ApiError('Choose 1 to 5 stars', 422);
  const comment = text(req.body?.comment, 500) || null;
  await prisma.job.update({ where: { id: job.id }, data: { rating: stars, ratingComment: comment, ratedAt: new Date() } });
  if (job.rider) {
    await notify(job.rider.userId, {
      kind: 'star', title: `You got ${stars} star${stars > 1 ? 's' : ''}`, body: comment || `For delivery ${job.code}`, link: `/rider/jobs/${job.id}`,
    });
  }
  const fresh = await prisma.job.findUnique({ where: { id: job.id }, include: jobs.jobInclude });
  res.json({ success: true, data: await jobs.jobView(fresh, req.user) });
});

/** The sender got the COD money from the rider. */
router.post('/:id/cod-returned', allow('CUSTOMER'), async (req, res) => {
  const job = await mine(req.params.id, req.user);
  if (job.status !== 'DELIVERED' || Number(job.codAmount) <= 0) throw new ApiError('There is no COD to confirm', 409);
  if (!job.codReturnedAt) {
    await prisma.job.update({ where: { id: job.id }, data: { codReturnedAt: new Date() } });
    if (job.rider) {
      await notify(job.rider.userId, {
        kind: 'cash', title: `COD ₱${Number(job.codAmount).toFixed(0)} confirmed`, body: `The sender got the money for ${job.code}. Thank you!`, link: `/rider/jobs/${job.id}`,
      });
    }
  }
  const fresh = await prisma.job.findUnique({ where: { id: job.id }, include: jobs.jobInclude });
  res.json({ success: true, data: await jobs.jobView(fresh, req.user) });
});

module.exports = router;
