/**
 * The rider: their application (filled in step by step, then sent to
 * MoorMove's admins) and, once approved, their work.
 */
const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, allow } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');
const { text, phone, isPhone, failIf } = require('../lib/check');
const { haversineKm, isPoint } = require('../lib/geo');
const { notifyAdmins } = require('../lib/notify');
const jobs = require('../lib/jobs');
const { publicUser } = require('./auth');

const router = express.Router();
router.use(authenticate, allow('RIDER'));

const VEHICLES = ['TRICYCLE', 'MOTORCYCLE', 'BICYCLE'];
const MOTORISED = ['TRICYCLE', 'MOTORCYCLE'];
const DOCUMENTS = ['selfieUploadId', 'idUploadId', 'licenseUploadId', 'orcrUploadId', 'vehicleUploadId'];
// The application can be changed only before it is sent, or when the admin
// asked for changes.
const EDITABLE = ['DRAFT', 'NEEDS_CHANGES'];

const riderView = (rider) => ({
  ...rider,
  town: rider.town ? { id: rider.town.id, name: rider.town.name } : null,
  reviewedById: undefined,
});

const findRider = (userId) => prisma.rider.findUnique({ where: { userId }, include: { town: true } });

/** Every account made as a rider has one; this covers any that don't. */
const ensureRider = async (userId) => (await findRider(userId))
  || prisma.rider.create({ data: { userId }, include: { town: true } });

router.get('/me', async (req, res) => {
  const rider = await ensureRider(req.user.id);
  res.json({ success: true, data: { user: publicUser(req.user), rider: riderView(rider) } });
});

/* ── Application ──────────────────────────────────────────────────────── */

/** Save what the rider has filled in so far (any subset of the fields). */
router.put('/application', async (req, res) => {
  const rider = await ensureRider(req.user.id);
  if (!EDITABLE.includes(rider.status)) {
    throw new ApiError('Your application was already sent and can no longer be changed', 409);
  }
  const body = req.body || {};
  const data = {};
  const errors = {};

  if ('townId' in body) {
    const town = body.townId ? await prisma.town.findFirst({ where: { id: String(body.townId), isActive: true } }) : null;
    if (body.townId && !town) errors.townId = 'Choose a town from the list';
    data.townId = town ? town.id : null;
  }
  if ('vehicleType' in body) {
    if (body.vehicleType && !VEHICLES.includes(body.vehicleType)) errors.vehicleType = 'Choose your vehicle';
    data.vehicleType = VEHICLES.includes(body.vehicleType) ? body.vehicleType : null;
  }
  for (const [field, max] of [['barangay', 80], ['plateNumber', 20], ['todaName', 120], ['mtopNumber', 40], ['licenseNumber', 40], ['emergencyName', 120]]) {
    if (field in body) data[field] = text(body[field], max) || null;
  }
  if (data.plateNumber) data.plateNumber = data.plateNumber.toUpperCase();
  if ('emergencyPhone' in body) {
    const value = phone(body.emergencyPhone);
    if (value && !isPhone(value)) errors.emergencyPhone = 'Enter a mobile number, like 09171234567';
    data.emergencyPhone = value || null;
  }
  // Only the rider's own photos.
  const docIds = DOCUMENTS.filter((field) => field in body && body[field]);
  if (docIds.length) {
    const owned = await prisma.upload.findMany({
      where: { id: { in: docIds.map((f) => String(body[f])) }, userId: req.user.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((u) => u.id));
    for (const field of docIds) {
      if (!ownedIds.has(String(body[field]))) errors[field] = 'Upload this photo again';
    }
  }
  for (const field of DOCUMENTS) {
    if (field in body) data[field] = body[field] ? String(body[field]) : null;
  }
  failIf(errors);

  const updated = await prisma.rider.update({ where: { id: rider.id }, data, include: { town: true } });
  res.json({ success: true, data: riderView(updated) });
});

/** What the application still needs before it can be sent: { field: message }. */
const missing = (r) => {
  const m = {};
  if (!r.townId) m.townId = 'Choose the town you will work in';
  if (!r.barangay) m.barangay = 'Enter your barangay';
  if (!r.vehicleType) m.vehicleType = 'Choose your vehicle';
  if (!r.selfieUploadId) m.selfieUploadId = 'Add a selfie';
  if (!r.idUploadId) m.idUploadId = 'Add a photo of a valid ID';
  if (!r.vehicleUploadId) m.vehicleUploadId = 'Add a photo of your vehicle';
  if (!r.emergencyName) m.emergencyName = 'Enter an emergency contact';
  if (!r.emergencyPhone) m.emergencyPhone = "Enter your emergency contact's number";
  if (MOTORISED.includes(r.vehicleType)) {
    if (!r.plateNumber) m.plateNumber = 'Enter the plate number';
    if (!r.licenseNumber) m.licenseNumber = "Enter your driver's license number";
    if (!r.licenseUploadId) m.licenseUploadId = "Add a photo of your driver's license";
    if (!r.orcrUploadId) m.orcrUploadId = 'Add a photo of the OR/CR';
  }
  if (r.vehicleType === 'TRICYCLE') {
    if (!r.todaName) m.todaName = 'Enter your TODA';
    if (!r.mtopNumber) m.mtopNumber = 'Enter the franchise (MTOP) number';
  }
  return m;
};

router.post('/application/submit', async (req, res) => {
  const rider = await ensureRider(req.user.id);
  if (!EDITABLE.includes(rider.status)) {
    throw new ApiError('Your application was already sent', 409);
  }
  failIf(missing(rider));
  const updated = await prisma.rider.update({
    where: { id: rider.id },
    data: { status: 'PENDING', submittedAt: new Date() },
    include: { town: true },
  });
  await notifyAdmins({
    kind: 'rider',
    title: 'New rider application',
    body: `${req.user.fullName}${updated.town ? `, ${updated.town.name}` : ''} is waiting for review.`,
    link: `/admin/riders/${rider.id}`,
  });
  res.json({ success: true, data: riderView(updated) });
});

/* ── Work ─────────────────────────────────────────────────────────────── */

/** The rider, who must be approved to work. */
const working = async (userId) => {
  const rider = await ensureRider(userId);
  if (rider.status !== 'APPROVED') throw new ApiError('Your rider account is not approved yet', 403);
  return rider;
};

const activeJob = (riderId) => prisma.job.findFirst({
  where: { riderId, status: { in: jobs.ACTIVE } },
  include: jobs.jobInclude,
});

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Everything the rider's home screen shows. */
router.get('/dashboard', async (req, res) => {
  const rider = await ensureRider(req.user.id);
  const data = { rider: riderView(rider), active: null, today: null, owed: 0 };
  if (rider.status === 'APPROVED') {
    const active = await activeJob(rider.id);
    const today = await prisma.job.aggregate({
      where: { riderId: rider.id, status: 'DELIVERED', deliveredAt: { gte: startOfDay() } },
      _sum: { riderEarning: true, distanceKm: true },
      _count: { _all: true },
    });
    const owed = await prisma.job.aggregate({
      where: { riderId: rider.id, status: 'DELIVERED', settlementId: null },
      _sum: { platformCut: true },
    });
    const summary = await jobs.riderSummary({ ...rider, user: req.user });
    data.active = active ? await jobs.jobView(active, req.user) : null;
    data.today = {
      earnings: jobs.num(today._sum.riderEarning) || 0,
      deliveries: today._count._all,
      km: jobs.num(today._sum.distanceKm) || 0,
    };
    data.owed = jobs.num(owed._sum.platformCut) || 0;
    // E-MOORM COD the rider still has to bring back to the shop.
    const cash = await prisma.job.findMany({
      where: { riderId: rider.id, source: 'EMOORM', status: 'DELIVERED', codAmount: { gt: 0 }, codReturnedAt: null },
      orderBy: { deliveredAt: 'asc' },
      select: { id: true, code: true, externalCode: true, pickupName: true, codAmount: true, deliveredAt: true },
    });
    data.cashToReturn = cash.map((j) => ({ ...j, codAmount: Number(j.codAmount) }));
    data.rating = summary.rating;
    data.ratingCount = summary.ratingCount;
    data.deliveries = summary.deliveries;
  }
  res.json({ success: true, data });
});

router.put('/online', async (req, res) => {
  const rider = await working(req.user.id);
  const online = Boolean(req.body?.online);
  const updated = await prisma.rider.update({
    where: { id: rider.id },
    data: { isOnline: online, ...(online ? { lastSeenAt: new Date() } : {}) },
    include: { town: true },
  });
  res.json({ success: true, data: riderView(updated) });
});

/** Where the rider is (sent every ~20 s while online). */
router.post('/location', async (req, res) => {
  const rider = await working(req.user.id);
  if (!isPoint(req.body)) throw new ApiError('No location', 400);
  await prisma.rider.update({
    where: { id: rider.id },
    data: { lastLat: Number(req.body.lat), lastLng: Number(req.body.lng), lastSeenAt: new Date() },
  });
  res.json({ success: true, data: { ok: true } });
});

/**
 * Open deliveries the rider can take: their town, their vehicle (E-MOORM
 * orders: any vehicle that carries the package).
 */
router.get('/jobs/available', async (req, res) => {
  const rider = await working(req.user.id);
  if (!rider.isOnline) return res.json({ success: true, data: { online: false, jobs: [] } });
  const rows = await prisma.job.findMany({
    where: { status: 'SEARCHING', townId: rider.townId, ...jobs.takeableBy(rider) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const here = rider.lastLat !== null ? { lat: rider.lastLat, lng: rider.lastLng } : null;
  const list = rows.map((j) => ({
    id: j.id, code: j.code, vehicleType: j.vehicleType,
    pickupBarangay: j.pickupBarangay, pickupAddress: j.pickupAddress, pickupName: j.pickupName,
    dropoffBarangay: j.dropoffBarangay, dropoffAddress: j.dropoffAddress,
    packageSize: j.packageSize, packageDetails: j.packageDetails,
    distanceKm: Number(j.distanceKm), riderEarning: Number(j.riderEarning), fee: Number(j.fee),
    feePaidBy: j.feePaidBy, codAmount: Number(j.codAmount), createdAt: j.createdAt,
    source: j.source, externalCode: j.externalCode,
    pickup: { lat: j.pickupLat, lng: j.pickupLng }, dropoff: { lat: j.dropoffLat, lng: j.dropoffLng },
    awayKm: here ? Math.round(haversineKm(here, { lat: j.pickupLat, lng: j.pickupLng }) * 1.3 * 10) / 10 : null,
  }));
  // Nearest pickups first when the rider's location is known.
  if (here) list.sort((a, b) => a.awayKm - b.awayKm);
  res.json({ success: true, data: { online: true, here, jobs: list } });
});

router.post('/jobs/:id/accept', async (req, res) => {
  const rider = await working(req.user.id);
  if (!rider.isOnline) throw new ApiError('Go online to take deliveries', 409);
  if (await activeJob(rider.id)) throw new ApiError('Finish your current delivery first', 409);
  const job = await prisma.job.findUnique({ where: { id: String(req.params.id) }, include: jobs.jobInclude });
  if (!job || job.townId !== rider.townId || !jobs.canTake(rider, job)) throw new ApiError('Delivery not found', 404);
  const updated = await jobs.move(job, {
    from: ['SEARCHING'],
    to: 'ACCEPTED',
    // An E-MOORM order goes on whatever vehicle the rider has.
    data: { riderId: rider.id, acceptedAt: new Date(), vehicleType: rider.vehicleType },
    actorId: req.user.id,
    lat: rider.lastLat,
    lng: rider.lastLng,
    conflict: 'Another rider took this delivery',
  });
  await jobs.tellCustomer(updated, 'A rider is on the way', `${req.user.fullName} accepted ${updated.code} and is heading to the pickup.`);
  res.json({ success: true, data: await jobs.jobView(updated, req.user) });
});

const myJob = async (id, rider) => {
  const job = await prisma.job.findUnique({ where: { id: String(id) }, include: jobs.jobInclude });
  if (!job || job.riderId !== rider.id) throw new ApiError('Delivery not found', 404);
  return job;
};

// Each step, from the status before it. Pickup and delivery need a photo.
const STEPS = {
  ACCEPTED: { to: 'AT_PICKUP', at: 'arrivedPickupAt' },
  AT_PICKUP: { to: 'PICKED_UP', at: 'pickedUpAt', photo: 'pickupPhotoId' },
  PICKED_UP: { to: 'AT_DROPOFF', at: 'arrivedDropoffAt' },
  AT_DROPOFF: { to: 'DELIVERED', at: 'deliveredAt', photo: 'deliveryPhotoId' },
};

router.post('/jobs/:id/step', async (req, res) => {
  const rider = await working(req.user.id);
  const job = await myJob(req.params.id, rider);
  const step = STEPS[job.status];
  if (!step) throw new ApiError('This delivery has no next step', 409);
  const data = { [step.at]: new Date() };
  if (step.photo) {
    const photoId = String(req.body?.photoId || '');
    const photo = photoId ? await prisma.upload.findFirst({ where: { id: photoId, userId: req.user.id } }) : null;
    if (!photo) {
      throw new ApiError(step.photo === 'pickupPhotoId' ? 'Take a photo of the package' : 'Take a photo as proof of delivery', 422, { photoId: 'Required' });
    }
    data[step.photo] = photo.id;
  }
  if (step.to === 'DELIVERED' && Number(job.codAmount) > 0 && req.body?.codCollected !== true) {
    throw new ApiError(`Collect the COD of ₱${Number(job.codAmount).toFixed(0)} first`, 422, { codCollected: 'Required' });
  }
  const lat = isPoint(req.body) ? Number(req.body.lat) : null;
  const lng = isPoint(req.body) ? Number(req.body.lng) : null;
  const updated = await jobs.move(job, { from: [job.status], to: step.to, data, actorId: req.user.id, lat, lng });

  const messages = {
    AT_PICKUP: ['Your rider is at the pickup', `${req.user.fullName} has arrived to pick up ${updated.code}.`],
    PICKED_UP: ['Package picked up', `${updated.code} is on its way to ${updated.dropoffBarangay}.`],
    AT_DROPOFF: ['Your rider has arrived', `${req.user.fullName} is at the drop-off for ${updated.code}.`],
    DELIVERED: ['Delivered!', `${updated.code} was delivered to ${updated.dropoffName}. Tap to see the photo and rate your rider.`],
  };
  await jobs.tellCustomer(updated, ...messages[step.to]);
  res.json({ success: true, data: await jobs.jobView(updated, req.user) });
});

/** Give the delivery back before pickup; it goes to other riders again. */
router.post('/jobs/:id/release', async (req, res) => {
  const rider = await working(req.user.id);
  const job = await myJob(req.params.id, rider);
  const reason = text(req.body?.reason, 255);
  if (!reason) throw new ApiError('Tell us why', 422, { reason: 'Required' });
  const updated = await jobs.move(job, {
    from: ['ACCEPTED', 'AT_PICKUP'],
    to: 'SEARCHING',
    data: { riderId: null, acceptedAt: null, arrivedPickupAt: null },
    actorId: req.user.id,
    note: `Rider gave it back: ${reason}`,
    conflict: 'You already have the package. If you cannot deliver it, report a problem instead.',
  });
  await jobs.tellCustomer(updated, 'Finding you another rider', `Your rider couldn't continue with ${updated.code}. We're looking for another one.`);
  res.json({ success: true, data: { released: true } });
});

/** After pickup: the delivery can't be completed (the package goes back). */
router.post('/jobs/:id/fail', async (req, res) => {
  const rider = await working(req.user.id);
  const job = await myJob(req.params.id, rider);
  const reason = text(req.body?.reason, 255);
  if (!reason) throw new ApiError('Tell us what happened', 422, { reason: 'Required' });
  const updated = await jobs.move(job, {
    from: ['PICKED_UP', 'AT_DROPOFF'],
    to: 'FAILED',
    data: { failedAt: new Date(), failReason: reason },
    actorId: req.user.id,
    note: reason,
  });
  await jobs.tellCustomer(updated, `${updated.code} couldn't be delivered`, `${reason}. The rider will bring the package back to ${updated.pickupName}.`);
  await jobs.failAlert(updated, `${req.user.fullName}: ${reason}`);
  res.json({ success: true, data: await jobs.jobView(updated, req.user) });
});

const HISTORY = {
  completed: { status: 'DELIVERED' },
  other: { status: { in: ['FAILED', 'CANCELLED'] } },
};

router.get('/jobs', async (req, res) => {
  const rider = await ensureRider(req.user.id);
  const tab = HISTORY[req.query.tab] ? req.query.tab : 'completed';
  const rows = await prisma.job.findMany({
    where: { riderId: rider.id, ...HISTORY[tab] },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  res.json({
    success: true,
    data: rows.map((j) => ({
      id: j.id, code: j.code, status: j.status, source: j.source, externalCode: j.externalCode,
      pickupBarangay: j.pickupBarangay, dropoffBarangay: j.dropoffBarangay,
      riderEarning: Number(j.riderEarning), codAmount: Number(j.codAmount), distanceKm: Number(j.distanceKm),
      rating: j.rating, deliveredAt: j.deliveredAt, updatedAt: j.updatedAt,
    })),
  });
});

router.get('/jobs/:id', async (req, res) => {
  const job = await jobs.findForViewer(req.params.id, req.user);
  res.json({ success: true, data: await jobs.jobView(job, req.user) });
});

/** Earnings: today, the last 7 days by day, this month, all time, and cash. */
router.get('/earnings', async (req, res) => {
  const rider = await ensureRider(req.user.id);
  const delivered = { riderId: rider.id, status: 'DELIVERED' };
  const sum = async (from) => {
    const a = await prisma.job.aggregate({
      where: { ...delivered, ...(from ? { deliveredAt: { gte: from } } : {}) },
      _sum: { riderEarning: true, distanceKm: true },
      _count: { _all: true },
    });
    return { earnings: jobs.num(a._sum.riderEarning) || 0, deliveries: a._count._all, km: jobs.num(a._sum.distanceKm) || 0 };
  };
  const today = startOfDay();
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const week = await prisma.job.findMany({
    where: { ...delivered, deliveredAt: { gte: weekStart } },
    select: { riderEarning: true, deliveredAt: true },
  });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return { date: d.toISOString().slice(0, 10), day: d, earnings: 0, deliveries: 0 };
  });
  for (const j of week) {
    const i = Math.floor((startOfDay(j.deliveredAt) - weekStart) / 86400000);
    if (days[i]) {
      days[i].earnings += Number(j.riderEarning);
      days[i].deliveries += 1;
    }
  }
  const owedRows = await prisma.job.findMany({
    where: { ...delivered, settlementId: null },
    select: { id: true, code: true, platformCut: true, deliveredAt: true },
    orderBy: { deliveredAt: 'desc' },
  });
  const settlements = await prisma.settlement.findMany({
    where: { riderId: rider.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, amount: true, note: true, createdAt: true },
  });
  const recent = await prisma.job.findMany({
    where: delivered,
    orderBy: { deliveredAt: 'desc' },
    take: 15,
    select: { id: true, code: true, pickupBarangay: true, dropoffBarangay: true, riderEarning: true, fee: true, platformCut: true, deliveredAt: true },
  });
  res.json({
    success: true,
    data: {
      today: await sum(today),
      week: await sum(weekStart),
      month: await sum(monthStart),
      all: await sum(null),
      days: days.map(({ date, earnings, deliveries }) => ({ date, earnings: Math.round(earnings * 100) / 100, deliveries })),
      owed: Math.round(owedRows.reduce((s, j) => s + Number(j.platformCut), 0) * 100) / 100,
      owedJobs: owedRows.length,
      settlements: settlements.map((s) => ({ ...s, amount: Number(s.amount) })),
      recent: recent.map((j) => ({ ...j, riderEarning: Number(j.riderEarning), fee: Number(j.fee), platformCut: Number(j.platformCut) })),
    },
  });
});

module.exports = router;
