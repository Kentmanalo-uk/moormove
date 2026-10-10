/**
 * MoorMove's own admin. (E-MOORM's admins have nothing to do with this.)
 */
const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const settingsLib = require('../lib/settings');
const { authenticate, allow } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');
const { text } = require('../lib/check');
const { notify } = require('../lib/notify');
const { townCenter } = require('../lib/geo');
const jobs = require('../lib/jobs');
const areas = require('../lib/areas');
const promos = require('../lib/promos');
const { SYSTEM_EMAIL } = require('../lib/partner');
const outbox = require('../lib/outbox');

const router = express.Router();
router.use(authenticate, allow('ADMIN'));

const STATUSES = ['DRAFT', 'PENDING', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'SUSPENDED'];
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const money = (d) => Math.round((Number(d) || 0) * 100) / 100;

/* ── Dashboard ────────────────────────────────────────────────────────── */

router.get('/summary', async (req, res) => {
  const today = startOfDay();
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  const groups = await prisma.rider.groupBy({ by: ['status'], _count: { _all: true } });
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const g of groups) counts[g.status] = g._count._all;

  const [towns, openTowns, online, customers, searching, active, bookedToday, deliveredToday, cancelledToday, balances] = await Promise.all([
    prisma.town.count({ where: { isActive: true } }),
    prisma.town.count({ where: { isActive: true, serviceOpen: true } }),
    prisma.rider.count({ where: { status: 'APPROVED', isOnline: true } }),
    prisma.user.count({ where: { role: 'CUSTOMER', email: { not: SYSTEM_EMAIL } } }),
    prisma.job.count({ where: { status: 'SEARCHING' } }),
    prisma.job.count({ where: { status: { in: jobs.ACTIVE } } }),
    prisma.job.count({ where: { createdAt: { gte: today } } }),
    prisma.job.aggregate({ where: { status: 'DELIVERED', deliveredAt: { gte: today } }, _count: { _all: true }, _sum: { fee: true, platformCut: true } }),
    prisma.job.count({ where: { status: { in: ['CANCELLED', 'FAILED'] }, updatedAt: { gte: today } } }),
    prisma.job.groupBy({ by: ['riderId'], where: { status: 'DELIVERED', settlementId: null, riderId: { not: null } }, _sum: { platformCut: true } }),
  ]);

  const week = await prisma.job.findMany({
    where: { status: 'DELIVERED', deliveredAt: { gte: weekStart } },
    select: { fee: true, deliveredAt: true },
  });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return { date: d.toISOString().slice(0, 10), deliveries: 0, fees: 0 };
  });
  for (const j of week) {
    const i = Math.floor((startOfDay(j.deliveredAt) - weekStart) / 86400000);
    if (days[i]) {
      days[i].deliveries += 1;
      days[i].fees += Number(j.fee);
    }
  }

  const recent = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { rider: { include: { user: { select: { fullName: true } } } }, town: { select: { name: true } } },
  });
  const waiting = await prisma.rider.findMany({
    where: { status: 'PENDING' },
    orderBy: { submittedAt: 'asc' },
    take: 5,
    include: { user: { select: { fullName: true } }, town: { select: { name: true } } },
  });

  res.json({
    success: true,
    data: {
      counts,
      towns,
      openTowns,
      ridersOnline: online,
      customers,
      searching,
      active,
      today: {
        booked: bookedToday,
        delivered: deliveredToday._count._all,
        cancelled: cancelledToday,
        fees: money(deliveredToday._sum.fee),
        commission: money(deliveredToday._sum.platformCut),
      },
      // What riders owe MoorMove, and what MoorMove owes riders for free
      // deliveries (each rider's balance counted one way).
      owed: money(balances.reduce((s, g) => s + Math.max(0, Number(g._sum.platformCut) || 0), 0)),
      moormoveOwes: money(balances.reduce((s, g) => s + Math.max(0, -(Number(g._sum.platformCut) || 0)), 0)),
      days: days.map((d) => ({ ...d, fees: money(d.fees) })),
      recent: recent.map((j) => ({
        id: j.id, code: j.code, status: j.status, town: j.town?.name, fee: Number(j.fee), vehicleType: j.vehicleType,
        source: j.source, externalCode: j.externalCode,
        pickupBarangay: j.pickupBarangay, dropoffBarangay: j.dropoffBarangay,
        riderName: j.rider?.user?.fullName || null, createdAt: j.createdAt,
      })),
      waiting: waiting.map((r) => ({ id: r.id, name: r.user.fullName, town: r.town?.name, vehicleType: r.vehicleType, submittedAt: r.submittedAt })),
    },
  });
});

/* ── Riders ───────────────────────────────────────────────────────────── */

const riderInclude = {
  user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true, lastLoginAt: true, isActive: true } },
  town: { select: { id: true, name: true } },
  reviewedBy: { select: { fullName: true } },
  ...areas.areasInclude,
};

/**
 * A rider with where they deliver: areas [{ townId, townName, serviceOpen,
 * barangay|null }] (empty: their whole home town, usesHomeTown) and a
 * one-line areasSummary.
 */
const withAreas = (rider) => {
  const area = areas.areaView(rider);
  return { ...rider, areas: area.areas, usesHomeTown: area.usesHomeTown, areasSummary: area.summary };
};

/** Open deliveries and online riders, with their pins, for the live map. */
router.get('/live', async (req, res) => {
  const [open, riders] = await Promise.all([
    prisma.job.findMany({
      where: { status: { in: ['SEARCHING', ...jobs.ACTIVE] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { rider: { include: { user: { select: { fullName: true } } } } },
    }),
    prisma.rider.findMany({
      where: { status: 'APPROVED', isOnline: true },
      include: { user: { select: { fullName: true } }, town: { select: { name: true } } },
    }),
  ]);
  const busy = new Set(open.filter((j) => j.riderId).map((j) => j.riderId));
  res.json({
    success: true,
    data: {
      jobs: open.map((j) => ({
        id: j.id, code: j.code, status: j.status, vehicleType: j.vehicleType,
        pickupBarangay: j.pickupBarangay, dropoffBarangay: j.dropoffBarangay,
        pickup: { lat: j.pickupLat, lng: j.pickupLng }, dropoff: { lat: j.dropoffLat, lng: j.dropoffLng },
        riderName: j.rider?.user.fullName || null, createdAt: j.createdAt,
      })),
      riders: riders.map((r) => ({
        id: r.id, name: r.user.fullName, vehicleType: r.vehicleType, town: r.town?.name || null,
        lat: r.lastLat, lng: r.lastLng, lastSeenAt: r.lastSeenAt, busy: busy.has(r.id),
      })),
    },
  });
});

/** ?status, ?q, ?online=1, ?townId (riders who deliver in some part of that town). */
router.get('/riders', async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : 'PENDING';
  const q = text(req.query.q, 80);
  const townId = text(req.query.townId, 64);
  const riders = await prisma.rider.findMany({
    where: {
      status,
      ...(req.query.online === '1' ? { isOnline: true } : {}),
      ...(townId ? { AND: [areas.inTownWhere(townId)] } : {}),
      ...(q ? {
        OR: [
          { user: { fullName: { contains: q } } },
          { user: { email: { contains: q } } },
          { user: { phone: { contains: q } } },
          { plateNumber: { contains: q } },
        ],
      } : {}),
    },
    include: riderInclude,
    // Oldest waiting first; otherwise the newest change first.
    orderBy: status === 'PENDING' ? { submittedAt: 'asc' } : { updatedAt: 'desc' },
    take: 200,
  });
  res.json({ success: true, data: riders.map(withAreas) });
});

router.get('/riders/:id', async (req, res) => {
  const rider = await prisma.rider.findUnique({ where: { id: String(req.params.id) }, include: riderInclude });
  if (!rider) throw new ApiError('Rider not found', 404);
  const summary = await jobs.riderSummary(rider);
  const earned = await prisma.job.aggregate({ where: { riderId: rider.id, status: 'DELIVERED' }, _sum: { riderEarning: true } });
  const owed = await prisma.job.aggregate({ where: { riderId: rider.id, status: 'DELIVERED', settlementId: null }, _sum: { platformCut: true } });
  const recent = await prisma.job.findMany({
    where: { riderId: rider.id },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: { id: true, code: true, status: true, pickupBarangay: true, dropoffBarangay: true, riderEarning: true, rating: true, updatedAt: true },
  });
  res.json({
    success: true,
    data: {
      ...withAreas(rider),
      stats: {
        deliveries: summary.deliveries,
        rating: summary.rating,
        ratingCount: summary.ratingCount,
        earned: money(earned._sum.riderEarning),
        // Signed: positive, the rider owes MoorMove; negative, MoorMove owes the rider.
        owed: money(owed._sum.platformCut),
        owedDirection: promos.balance(owed._sum.platformCut).direction,
      },
      recent: recent.map((j) => ({ ...j, riderEarning: Number(j.riderEarning) })),
    },
  });
});

// What each decision does, from which state, and what the rider is told.
const ACTIONS = {
  approve: { from: ['PENDING'], to: 'APPROVED', needsNote: false, tell: ['You\'re approved!', 'Welcome to MoorMove. Go online to start taking deliveries.'] },
  needs_changes: { from: ['PENDING'], to: 'NEEDS_CHANGES', needsNote: true, tell: ['Your application needs changes', null] },
  reject: { from: ['PENDING'], to: 'REJECTED', needsNote: true, tell: ['Your application was not approved', null] },
  suspend: { from: ['APPROVED'], to: 'SUSPENDED', needsNote: true, tell: ['Your rider account is suspended', null] },
  reinstate: { from: ['SUSPENDED'], to: 'APPROVED', needsNote: false, tell: ['Your rider account is active again', 'You can go online and take deliveries.'] },
};

router.patch('/riders/:id', async (req, res) => {
  const action = ACTIONS[req.body?.action];
  if (!action) throw new ApiError('Unknown action', 400);
  const note = text(req.body?.note, 1000);
  if (action.needsNote && !note) {
    throw new ApiError('Tell the rider why (they will see this note)', 422, { note: 'Required' });
  }
  const id = String(req.params.id);
  if (action.to === 'SUSPENDED') {
    const busy = await prisma.job.count({ where: { riderId: id, status: { in: jobs.ACTIVE } } });
    if (busy) throw new ApiError('This rider is in the middle of a delivery. Reassign or cancel it first.', 409);
  }
  // Only from the expected state, so two admins can't decide twice.
  const { count } = await prisma.rider.updateMany({
    where: { id, status: { in: action.from } },
    data: {
      status: action.to,
      reviewNote: note || null,
      reviewedAt: new Date(),
      reviewedById: req.user.id,
      ...(action.to === 'APPROVED' ? {} : { isOnline: false }),
    },
  });
  if (!count) {
    const exists = await prisma.rider.findUnique({ where: { id }, select: { status: true } });
    if (!exists) throw new ApiError('Rider not found', 404);
    throw new ApiError(`This rider is ${exists.status.toLowerCase().replace('_', ' ')} now; reload the page`, 409);
  }
  const rider = await prisma.rider.findUnique({ where: { id }, include: riderInclude });
  await notify(rider.userId, { kind: 'rider', title: action.tell[0], body: action.tell[1] || note, link: '/rider' });
  res.json({ success: true, data: withAreas(rider) });
});

/**
 * Set where a rider delivers: { areas: [{ townId, barangay|null }] }, the
 * same rules as the rider's own (an empty list: their whole home town).
 */
router.put('/riders/:id/areas', async (req, res) => {
  const found = await prisma.rider.findUnique({ where: { id: String(req.params.id) }, select: { id: true } });
  if (!found) throw new ApiError('Rider not found', 404);
  const { rows, notices } = await areas.readAreas(req.body);
  await areas.saveAreas(found.id, rows);
  const rider = await prisma.rider.findUnique({ where: { id: found.id }, include: riderInclude });
  const view = withAreas(rider);
  await notify(rider.userId, {
    kind: 'rider',
    title: 'Where you deliver was changed',
    body: `MoorMove set your delivery area: ${view.areasSummary || 'your home town'}.`,
    link: '/rider',
  });
  res.json({ success: true, data: { ...view, notices } });
});

/**
 * Per town: how many approved riders deliver in some part of it, and how
 * many of them are online now.
 */
router.get('/coverage', async (req, res) => {
  const [towns, counts] = await Promise.all([
    prisma.town.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, serviceOpen: true } }),
    areas.townCounts(),
  ]);
  res.json({
    success: true,
    data: towns.map((t) => ({
      townId: t.id,
      name: t.name,
      serviceOpen: t.serviceOpen,
      ridersApproved: counts.get(t.id)?.approved || 0,
      ridersOnline: counts.get(t.id)?.online || 0,
    })),
  });
});

/* ── Customers ────────────────────────────────────────────────────────── */

router.get('/customers', async (req, res) => {
  const q = text(req.query.q, 80);
  const users = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      email: { not: SYSTEM_EMAIL },
      ...(q ? { OR: [{ fullName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true, lastLoginAt: true,
      _count: { select: { bookedJobs: true } },
    },
  });
  res.json({ success: true, data: users.map(({ _count, ...u }) => ({ ...u, deliveries: _count.bookedJobs })) });
});

router.get('/customers/:id', async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: String(req.params.id), role: 'CUSTOMER' },
    select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true, lastLoginAt: true },
  });
  if (!user) throw new ApiError('Customer not found', 404);
  const list = await prisma.job.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, code: true, status: true, pickupBarangay: true, dropoffBarangay: true, fee: true, createdAt: true },
  });
  const spent = await prisma.job.aggregate({ where: { customerId: user.id, status: 'DELIVERED' }, _sum: { fee: true }, _count: { _all: true } });
  res.json({
    success: true,
    data: {
      ...user,
      stats: { delivered: spent._count._all, spent: money(spent._sum.fee) },
      jobs: list.map((j) => ({ ...j, fee: Number(j.fee) })),
    },
  });
});

/** Turn an account off or on (riders and customers, never yourself). */
router.patch('/users/:id', async (req, res) => {
  if (typeof req.body?.isActive !== 'boolean') throw new ApiError('Say whether the account is on', 400);
  const id = String(req.params.id);
  if (id === req.user.id) throw new ApiError("You can't turn off your own account", 409);
  const user = await prisma.user.findUnique({ where: { id }, include: { rider: true } });
  if (!user || user.role === 'ADMIN') throw new ApiError('Account not found', 404);
  await prisma.user.update({ where: { id }, data: { isActive: req.body.isActive } });
  if (!req.body.isActive && user.rider) {
    await prisma.rider.update({ where: { id: user.rider.id }, data: { isOnline: false } });
  }
  res.json({ success: true, data: { id, isActive: req.body.isActive } });
});

/* ── Deliveries ───────────────────────────────────────────────────────── */

const JOB_TABS = {
  searching: { status: 'SEARCHING' },
  active: { status: { in: jobs.ACTIVE } },
  delivered: { status: 'DELIVERED' },
  problems: { status: { in: ['CANCELLED', 'FAILED'] } },
  all: {},
};

router.get('/jobs', async (req, res) => {
  const tab = JOB_TABS[req.query.tab] ? req.query.tab : 'active';
  const q = text(req.query.q, 60);
  const where = {
    ...JOB_TABS[tab],
    ...(req.query.townId ? { townId: String(req.query.townId) } : {}),
    ...(['MOORMOVE', 'EMOORM'].includes(req.query.source) ? { source: req.query.source } : {}),
    ...(q ? {
      OR: [
        { code: { contains: q } }, { pickupName: { contains: q } }, { dropoffName: { contains: q } },
        { pickupPhone: { contains: q } }, { dropoffPhone: { contains: q } }, { externalCode: { contains: q } },
      ],
    } : {}),
  };
  const rows = await prisma.job.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      rider: { include: { user: { select: { fullName: true } } } },
      town: { select: { name: true } },
      dropoffTown: { select: { id: true, name: true } },
      promo: { select: { id: true, title: true } },
    },
  });
  const counts = Object.fromEntries(await Promise.all(Object.entries(JOB_TABS).map(async ([k, w]) => [k, await prisma.job.count({ where: w })])));
  res.json({
    success: true,
    data: {
      counts,
      jobs: rows.map((j) => ({
        id: j.id, code: j.code, status: j.status, town: j.town?.name, vehicleType: j.vehicleType,
        pickupName: j.pickupName, pickupBarangay: j.pickupBarangay, dropoffName: j.dropoffName, dropoffBarangay: j.dropoffBarangay,
        fee: Number(j.fee), codAmount: Number(j.codAmount), riderName: j.rider?.user?.fullName || null,
        source: j.source, externalCode: j.externalCode, createdAt: j.createdAt,
        // A free-delivery promo, the usual fare, and where it goes when that's another town.
        promo: j.promo || null, listFee: j.listFee === null ? null : Number(j.listFee),
        dropoffTown: j.dropoffTown && j.dropoffTown.id !== j.townId ? j.dropoffTown : null,
      })),
    },
  });
});

/** Book a delivery for someone who called or walked in. */
router.post('/jobs', async (req, res) => {
  const job = await jobs.createJob({ body: req.body, createdById: req.user.id, customerId: null });
  res.status(201).json({ success: true, data: { id: job.id, code: job.code } });
});

router.get('/jobs/:id', async (req, res) => {
  const job = await jobs.findForViewer(req.params.id, req.user);
  res.json({ success: true, data: await jobs.jobView(job, req.user) });
});

/**
 * Riders who could take this delivery now: the right vehicle (E-MOORM
 * orders: any vehicle that carries the package), free, and working in the
 * delivery's towns. Those whose area has both the pickup and the drop-off
 * come first (coversArea); the admin may still give it to one outside it.
 */
router.get('/jobs/:id/riders', async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: String(req.params.id) } });
  if (!job) throw new ApiError('Delivery not found', 404);
  const townIds = areas.jobPlaces(job).map((p) => p.townId);
  const riders = await prisma.rider.findMany({
    where: {
      status: 'APPROVED',
      vehicleType: { in: jobs.vehiclesFor(job) },
      user: { isActive: true },
      jobs: { none: { status: { in: jobs.ACTIVE } } },
      // Their home town, or some of their area, is the pickup's or the drop-off's town.
      OR: [{ townId: { in: townIds } }, areas.nearWhere(townIds)],
    },
    include: { user: { select: { fullName: true, phone: true } }, town: { select: { id: true, name: true } }, ...areas.areasInclude },
    orderBy: [{ isOnline: 'desc' }, { lastSeenAt: 'desc' }],
  });
  const rows = riders.map((r) => ({
    id: r.id, name: r.user.fullName, phone: r.user.phone, plateNumber: r.plateNumber, barangay: r.barangay,
    vehicleType: r.vehicleType, isOnline: r.isOnline, lastSeenAt: r.lastSeenAt,
    coversArea: areas.coversJob(r, job), areasSummary: areas.summary(r),
  }));
  // Covering riders first; within each group, online and last seen first.
  res.json({ success: true, data: [...rows.filter((r) => r.coversArea), ...rows.filter((r) => !r.coversArea)] });
});

router.post('/jobs/:id/assign', async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: String(req.params.id) }, include: jobs.jobInclude });
  if (!job) throw new ApiError('Delivery not found', 404);
  const rider = await prisma.rider.findUnique({ where: { id: String(req.body?.riderId || '') }, include: { user: true, areas: true } });
  if (!rider || rider.status !== 'APPROVED' || !jobs.fitsVehicle(rider, job)) {
    throw new ApiError('Choose an approved rider with the right vehicle', 422);
  }
  // The admin may give it to a rider outside their area; the log says so.
  const outside = !areas.coversJob(rider, job);
  if (await prisma.job.count({ where: { riderId: rider.id, status: { in: jobs.ACTIVE } } })) {
    throw new ApiError(`${rider.user.fullName} is busy with another delivery`, 409);
  }
  const updated = await jobs.move(job, {
    from: ['SEARCHING'],
    to: 'ACCEPTED',
    data: { riderId: rider.id, acceptedAt: new Date(), vehicleType: rider.vehicleType },
    actorId: req.user.id,
    note: `Assigned by ${req.user.fullName}${outside ? " (outside the rider's area)" : ''}`,
    conflict: 'This delivery already has a rider',
  });
  await notify(rider.userId, {
    kind: 'job', title: 'You were given a delivery', body: `${updated.code}: ${updated.pickupBarangay} → ${updated.dropoffBarangay}. Head to the pickup.`, link: `/rider/jobs/${updated.id}`,
  });
  await jobs.tellCustomer(updated, 'A rider is on the way', `${rider.user.fullName} will deliver ${updated.code}.`);
  res.json({ success: true, data: await jobs.jobView(updated, req.user) });
});

router.post('/jobs/:id/cancel', async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: String(req.params.id) }, include: jobs.jobInclude });
  if (!job) throw new ApiError('Delivery not found', 404);
  const reason = text(req.body?.reason, 255);
  if (!reason) throw new ApiError('Give a reason', 422, { reason: 'Required' });
  const updated = await jobs.move(job, {
    from: jobs.OPEN,
    to: 'CANCELLED',
    data: { cancelledAt: new Date(), cancelReason: reason },
    actorId: req.user.id,
    note: `Cancelled by MoorMove: ${reason}`,
    conflict: 'This delivery is already finished',
  });
  await jobs.tellCustomer(updated, `${updated.code} was cancelled`, `MoorMove cancelled your delivery: ${reason}`);
  if (job.rider) {
    await notify(job.rider.userId, { kind: 'job', title: `${job.code} was cancelled`, body: reason, link: `/rider/jobs/${job.id}` });
  }
  res.json({ success: true, data: await jobs.jobView(updated, req.user) });
});

/* ── Cash: commission riders owe ──────────────────────────────────────── */

router.get('/cash', async (req, res) => {
  const owed = await prisma.job.groupBy({
    by: ['riderId'],
    where: { status: 'DELIVERED', settlementId: null, riderId: { not: null } },
    _sum: { platformCut: true },
    _count: { _all: true },
  });
  const riders = await prisma.rider.findMany({
    where: { id: { in: owed.map((o) => o.riderId) } },
    include: { user: { select: { fullName: true, phone: true } }, town: { select: { name: true } } },
  });
  const byId = Object.fromEntries(riders.map((r) => [r.id, r]));
  const settlements = await prisma.settlement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { rider: { include: { user: { select: { fullName: true } } } }, recordedBy: { select: { fullName: true } } },
  });
  res.json({
    success: true,
    data: {
      // amount is signed: positive, the rider owes MoorMove; negative, MoorMove
      // owes the rider (free-delivery promos). direction says which.
      owed: owed
        .map((o) => {
          const b = promos.balance(o._sum.platformCut);
          return {
            riderId: o.riderId, name: byId[o.riderId]?.user.fullName, phone: byId[o.riderId]?.user.phone,
            town: byId[o.riderId]?.town?.name, amount: b.owed, direction: b.direction, jobs: o._count._all,
          };
        })
        .filter((o) => o.amount !== 0)
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
      settlements: settlements.map((s) => ({
        id: s.id, amount: Number(s.amount), note: s.note, createdAt: s.createdAt,
        rider: s.rider.user.fullName, recordedBy: s.recordedBy.fullName,
      })),
    },
  });
});

/**
 * Settle a rider's balance against their unsettled deliveries: the rider
 * paid what they owe, or (negative amount) MoorMove paid the rider what it
 * owed for free deliveries.
 */
router.post('/cash/:riderId/settle', async (req, res) => {
  const riderId = String(req.params.riderId);
  const rider = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw new ApiError('Rider not found', 404);
  const note = text(req.body?.note, 255) || null;
  const settlement = await prisma.$transaction(async (tx) => {
    const due = await tx.job.findMany({ where: { riderId, status: 'DELIVERED', settlementId: null }, select: { id: true, platformCut: true } });
    const amount = money(due.reduce((s, j) => s + Number(j.platformCut), 0));
    if (!due.length || amount === 0) throw new ApiError('Nothing is owed either way right now', 409);
    const row = await tx.settlement.create({ data: { riderId, amount, note, recordedById: req.user.id } });
    await tx.job.updateMany({ where: { id: { in: due.map((j) => j.id) }, settlementId: null }, data: { settlementId: row.id } });
    return row;
  });
  const paid = Number(settlement.amount);
  await notify(rider.userId, paid > 0
    ? { kind: 'cash', title: `₱${paid.toFixed(2)} received`, body: 'MoorMove recorded your commission payment. Thank you!', link: '/rider/earnings' }
    : { kind: 'cash', title: `MoorMove paid you ₱${(-paid).toFixed(2)}`, body: 'Your earnings from free deliveries (and any commission due) are settled.', link: '/rider/earnings' });
  // amount: positive, the rider paid MoorMove; negative, MoorMove paid the rider.
  res.json({ success: true, data: { id: settlement.id, amount: paid, direction: paid > 0 ? 'RIDER_PAID' : 'MOORMOVE_PAID' } });
});

/* ── Free-delivery promos ─────────────────────────────────────────────── */

// On and not over (running now, or starting later).
const isLive = (p) => p.active && (!p.endsAt || p.endsAt > new Date());

/** A promo with its deliveries: how many, and what MoorMove paid riders for the delivered ones. */
const promoWithUse = async (p) => {
  const [count, delivered] = await Promise.all([
    prisma.job.count({ where: { promoId: p.id } }),
    prisma.job.aggregate({ where: { promoId: p.id, status: 'DELIVERED' }, _count: { _all: true }, _sum: { riderEarning: true } }),
  ]);
  return promos.view(p, {
    createdBy: p.createdBy?.fullName || null,
    jobs: count,
    delivered: delivered._count._all,
    paidToRiders: money(delivered._sum.riderEarning),
  });
};

/** All promos, newest first, each with state SCHEDULED | ON | ENDED | OFF. */
router.get('/promos', async (req, res) => {
  const rows = await prisma.promo.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { createdBy: { select: { fullName: true } } } });
  res.json({ success: true, data: await Promise.all(rows.map(promoWithUse)) });
});

/**
 * A new promo: { title, note?, startsAt? (default now), endsAt?, townIds?
 * (null or []: all towns), maxKm? (null: any), active? }. Riders in its
 * towns are told.
 */
router.post('/promos', async (req, res) => {
  const data = await promos.readForm(req.body);
  const promo = await prisma.promo.create({
    data: { active: true, ...data, townIds: data.townIds || undefined, createdById: req.user.id },
    include: { createdBy: { select: { fullName: true } } },
  });
  const told = isLive(promo) ? await promos.tellRiders(promo) : 0;
  res.status(201).json({ success: true, data: { ...(await promoWithUse(promo)), ridersTold: told } });
});

/** Change a promo (any of the fields above); switching it on tells the riders. */
router.put('/promos/:id', async (req, res) => {
  const current = await prisma.promo.findUnique({ where: { id: String(req.params.id) } });
  if (!current) throw new ApiError('Promo not found', 404);
  const data = await promos.readForm(req.body, current);
  // All towns again: the JSON column back to NULL.
  if ('townIds' in data && data.townIds === null) data.townIds = Prisma.DbNull;
  const promo = await prisma.promo.update({ where: { id: current.id }, data, include: { createdBy: { select: { fullName: true } } } });
  const told = !isLive(current) && isLive(promo) ? await promos.tellRiders(promo) : 0;
  res.json({ success: true, data: { ...(await promoWithUse(promo)), ridersTold: told } });
});

/** End a promo now. Free deliveries already booked stay free. */
router.post('/promos/:id/end', async (req, res) => {
  const current = await prisma.promo.findUnique({ where: { id: String(req.params.id) } });
  if (!current) throw new ApiError('Promo not found', 404);
  if (current.endsAt && current.endsAt <= new Date()) throw new ApiError('This promo has already ended', 409);
  const now = new Date();
  // A promo that hadn't started yet ends before it ever runs.
  const promo = await prisma.promo.update({
    where: { id: current.id },
    data: { endsAt: now, ...(current.startsAt > now ? { startsAt: now } : {}) },
    include: { createdBy: { select: { fullName: true } } },
  });
  res.json({ success: true, data: await promoWithUse(promo) });
});

/* ── Settings and towns ───────────────────────────────────────────────── */

router.get('/settings', async (req, res) => {
  res.json({ success: true, data: await settingsLib.get() });
});

router.put('/settings', async (req, res) => {
  const b = req.body || {};
  const errors = {};
  const n = (value, key, { min = 0, max = 100000 } = {}) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v < min || v > max) {
      errors[key] = `Enter a number from ${min} to ${max}`;
      return 0;
    }
    return Math.round(v * 100) / 100;
  };
  const vehicles = {};
  for (const v of Object.keys(settingsLib.DEFAULTS.vehicles)) {
    vehicles[v] = { base: n(b.vehicles?.[v]?.base, `${v}.base`, { max: 2000 }), perKm: n(b.vehicles?.[v]?.perKm, `${v}.perKm`, { max: 500 }) };
  }
  const data = {
    vehicles,
    includedKm: n(b.includedKm, 'includedKm', { max: 50 }),
    sizeSurcharge: {
      SMALL: n(b.sizeSurcharge?.SMALL, 'SMALL', { max: 2000 }),
      MEDIUM: n(b.sizeSurcharge?.MEDIUM, 'MEDIUM', { max: 2000 }),
      LARGE: n(b.sizeSurcharge?.LARGE, 'LARGE', { max: 2000 }),
    },
    roadFactor: n(b.roadFactor, 'roadFactor', { min: 1, max: 3 }),
    maxDistanceKm: n(b.maxDistanceKm, 'maxDistanceKm', { min: 1, max: 200 }),
    commissionPercent: n(b.commissionPercent, 'commissionPercent', { max: 50 }),
    maxCod: n(b.maxCod, 'maxCod', { max: 100000 }),
    bookingOpen: Boolean(b.bookingOpen),
    partnerOpen: Boolean(b.partnerOpen),
    publicBooking: Boolean(b.publicBooking),
    supportPhone: text(b.supportPhone, 20),
    supportEmail: text(b.supportEmail, 120),
  };
  if (Object.keys(errors).length) throw new ApiError('Check the marked numbers', 422, errors);
  res.json({ success: true, data: await settingsLib.save(data) });
});

/** The E-MOORM link: is the secret set, and are E-MOORM's updates getting through. */
router.get('/partner', async (req, res) => {
  res.json({ success: true, data: await outbox.status() });
});

/** Towns, each with the approved riders who deliver in some part of it (riders, ridersOnline). */
router.get('/towns', async (req, res) => {
  const towns = await prisma.town.findMany({ orderBy: { name: 'asc' } });
  const counts = await areas.townCounts();
  const done = await prisma.job.groupBy({ by: ['townId'], where: { status: 'DELIVERED' }, _count: { _all: true } });
  const d = Object.fromEntries(done.map((g) => [g.townId, g._count._all]));
  res.json({
    success: true,
    data: towns.map((t) => ({
      ...t,
      center: townCenter(t.name),
      riders: counts.get(t.id)?.approved || 0,
      ridersOnline: counts.get(t.id)?.online || 0,
      delivered: d[t.id] || 0,
    })),
  });
});

module.exports = router;
