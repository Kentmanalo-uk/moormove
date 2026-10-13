/**
 * Deliveries: booking, who may see what, and the steps.
 */
const crypto = require('crypto');
const prisma = require('./prisma');
const settingsLib = require('./settings');
const { quote, carries } = require('./fare');
const { inProvince, isPoint } = require('./geo');
const { notify, notifyAdmins } = require('./notify');
const { ApiError } = require('../middleware/errors');
const { text, phone, isPhone, failIf } = require('./check');
const areas = require('./areas');
const promos = require('./promos');

// RETURNING: an E-MOORM parcel the rider couldn't deliver, on its way back to
// the shop. It is still the rider's job (their task: "Return the parcel to
// <shop>") until the shop confirms it has the parcel.
const ACTIVE = ['ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'RETURNING'];
const OPEN = ['SEARCHING', ...ACTIVE];
const DONE = ['DELIVERED', 'CANCELLED', 'FAILED'];
const VEHICLES = ['TRICYCLE', 'MOTORCYCLE', 'BICYCLE'];
const SIZES = ['SMALL', 'MEDIUM', 'LARGE'];

const VEHICLE_NAMES = { TRICYCLE: 'tricycle', MOTORCYCLE: 'motorcycle', BICYCLE: 'bicycle' };

// No look-alike letters, so a code read out over the phone is unambiguous.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => `MM-${Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')}`;

const num = (d) => (d === null || d === undefined ? null : Number(d));

/**
 * Jobs that pay their rider, as a query: delivered ones, and failed E-MOORM
 * trips that were the buyer's fault (failPaid, once the parcel is back).
 * With `from`, those that ended since then (deliveredAt or returnedAt).
 * Earnings, commission owed and settlements all count these.
 */
const paidWhere = (from = null) => ({
  OR: [
    { status: 'DELIVERED', ...(from ? { deliveredAt: { gte: from } } : {}) },
    { status: 'FAILED', failPaid: true, ...(from ? { returnedAt: { gte: from } } : {}) },
  ],
});

/** When a paying job ended: delivered, or (a paid failed trip) the parcel back. */
const doneAt = (job) => job.deliveredAt || job.returnedAt || null;

/**
 * What a failed E-MOORM trip means for the rider's pay (RETURNING, or FAILED
 * after pickup); null otherwise. The buyer's fault: the rider earns as for a
 * delivery: from the fee the shop paid at pickup (kept), from the shop when
 * the parcel is back (shopPays, cash on delivery), or from MoorMove
 * (moormovePays, a free-delivery promo). Not the buyer's fault: no pay, and
 * a fee the shop paid at pickup goes back to the shop (giveBack).
 */
const tripPay = (job) => {
  if (job.source !== 'EMOORM' || !['RETURNING', 'FAILED'].includes(job.status) || !job.failedAt) return null;
  const fee = num(job.fee) || 0;
  const paid = Boolean(job.buyerFault);
  const free = num(job.platformCut) < 0;
  const byShop = job.feePaidBy === 'SENDER' && fee > 0;
  return {
    paid,
    earning: num(job.riderEarning),
    shopPays: paid && !free && job.feePaidBy === 'RECIPIENT' && fee > 0 ? fee : 0,
    moormovePays: paid && free ? -num(job.platformCut) : 0,
    giveBack: !paid && byShop ? fee : 0,
    kept: paid && byShop ? fee : 0,
  };
};

/** Read and check a booking form. */
const readBooking = (body, settings) => {
  const b = body || {};
  const errors = {};
  const stop = (key) => {
    const s = b[key] || {};
    const out = {
      name: text(s.name, 120),
      phone: phone(s.phone),
      address: text(s.address, 255),
      barangay: text(s.barangay, 80),
      notes: text(s.notes, 255) || null,
      lat: Number(s.lat),
      lng: Number(s.lng),
    };
    if (out.name.length < 2) errors[`${key}.name`] = 'Enter a name';
    if (!isPhone(out.phone)) errors[`${key}.phone`] = 'Enter a mobile number, like 09171234567';
    if (out.address.length < 3) errors[`${key}.address`] = 'Enter the street, building or landmark';
    if (!out.barangay) errors[`${key}.barangay`] = 'Enter the barangay';
    if (!isPoint(s) || !inProvince(out)) errors[`${key}.pin`] = 'Drop a pin on the map';
    return out;
  };
  const pickup = stop('pickup');
  const dropoff = stop('dropoff');
  const vehicleType = VEHICLES.includes(b.vehicleType) ? b.vehicleType : null;
  const packageSize = SIZES.includes(b.packageSize) ? b.packageSize : null;
  const packageDetails = text(b.packageDetails, 255);
  const feePaidBy = b.feePaidBy === 'RECIPIENT' ? 'RECIPIENT' : 'SENDER';
  const codAmount = Math.round(Number(b.codAmount) || 0);

  if (!b.townId) errors.townId = 'Choose the town';
  if (!vehicleType) errors.vehicleType = 'Choose a vehicle';
  if (!packageSize) errors.packageSize = 'Choose the package size';
  if (vehicleType && packageSize && !carries(vehicleType, packageSize)) {
    errors.vehicleType = `A ${VEHICLE_NAMES[vehicleType]} can't carry a ${packageSize.toLowerCase()} package`;
  }
  if (packageDetails.length < 2) errors.packageDetails = 'Say what the package is';
  if (codAmount < 0 || codAmount > settings.maxCod) errors.codAmount = `COD can be up to ₱${settings.maxCod}`;
  failIf(errors);
  return { pickup, dropoff, vehicleType, packageSize, packageDetails, feePaidBy, codAmount, townId: String(b.townId) };
};

/**
 * Whose vehicle fits a job: riders with the same vehicle; for E-MOORM orders,
 * any vehicle that carries the package (the fare was set with the cheapest one).
 */
const fitsVehicle = (rider, job) => rider.vehicleType === job.vehicleType
  || (job.source === 'EMOORM' && carries(rider.vehicleType, job.packageSize));

/** The vehicles that fit a job. */
const vehiclesFor = (job) => VEHICLES.filter((v) => fitsVehicle({ vehicleType: v }, job));

/**
 * Who may take a job: the vehicle fits, and both its pickup and its drop-off
 * are in the rider's area (`rider.areas` loaded; see lib/areas.js).
 */
const canTake = (rider, job) => fitsVehicle(rider, job) && areas.coversJob(rider, job);

/**
 * The same rule as a query, as far as a query can tell: open jobs for the
 * rider's vehicle with both ends in the rider's towns. Check each with
 * canTake for the barangays.
 */
const takeableBy = (rider) => ({
  AND: [
    {
      OR: [
        { vehicleType: rider.vehicleType },
        { source: 'EMOORM', packageSize: { in: settingsLib.CARRIES[rider.vehicleType] || [] } },
      ],
    },
    areas.jobsNearWhere(rider),
  ],
});

/** Tell the online riders who could take a new job (free, and it is in their area) about it. */
const alertRiders = async (job) => {
  const riders = await areas.ridersCovering(areas.jobPlaces(job), {
    where: { status: 'APPROVED', isOnline: true, vehicleType: { in: vehiclesFor(job) }, jobs: { none: { status: { in: ACTIVE } } } },
  });
  await notify(riders.map((r) => r.userId), {
    kind: 'job',
    title: job.promoId
      ? `Free delivery · you earn ₱${Number(job.riderEarning).toFixed(0)} (paid by MoorMove)`
      : `New delivery · ₱${Number(job.riderEarning).toFixed(0)}`,
    body: `${job.externalCode ? `E-MOORM order #${job.externalCode}: ` : ''}${job.pickupBarangay} → ${job.dropoffBarangay}, ${num(job.distanceKm)} km`,
    link: `/rider/jobs/${job.id}`,
  });
};

/** Book a delivery (by a customer, or by an admin for someone). */
const createJob = async ({ body, createdById, customerId }) => {
  const settings = await settingsLib.get();
  if (!settings.bookingOpen) throw new ApiError('MoorMove is not taking bookings right now. Please try again later.', 503);
  const b = readBooking(body, settings);
  const town = await prisma.town.findFirst({ where: { id: b.townId, isActive: true } });
  if (!town) throw new ApiError('Choose a town from the list', 422, { townId: 'Choose a town from the list' });
  if (!town.serviceOpen) throw new ApiError(`MoorMove isn't open in ${town.name} yet`, 422, { townId: 'Not open yet' });

  // By road from pickup to drop-off (an ESTIMATE when the route service is out).
  const price = await quote(settings, b);
  if (price.distanceKm > settings.maxDistanceKm) {
    throw new ApiError(`That's ${price.distanceKm} km. MoorMove delivers up to ${settings.maxDistanceKm} km.`, 422, { 'dropoff.pin': 'Too far' });
  }
  if (price.distanceKm < 0.05) {
    throw new ApiError('Pickup and drop-off are at the same spot', 422, { 'dropoff.pin': 'Move the pin' });
  }
  // A free-delivery promo: the customer pays nothing, MoorMove pays the rider.
  const promo = await promos.applicable({ townId: town.id, distanceKm: price.distanceKm });
  const money = promo
    ? { ...promos.freeMoney(price.fee, settings), promoId: promo.id }
    : { fee: price.fee, platformCut: price.platformCut, riderEarning: price.riderEarning };

  let job;
  for (let attempt = 0; !job; attempt += 1) {
    try {
      job = await prisma.job.create({
        data: {
          code: newCode(),
          customerId: customerId || null,
          createdById,
          townId: town.id,
          // Booked on MoorMove: both pins are in the chosen town.
          dropoffTownId: town.id,
          vehicleType: b.vehicleType,
          pickupName: b.pickup.name,
          pickupPhone: b.pickup.phone,
          pickupAddress: b.pickup.address,
          pickupBarangay: b.pickup.barangay,
          pickupLat: b.pickup.lat,
          pickupLng: b.pickup.lng,
          pickupNotes: b.pickup.notes,
          dropoffName: b.dropoff.name,
          dropoffPhone: b.dropoff.phone,
          dropoffAddress: b.dropoff.address,
          dropoffBarangay: b.dropoff.barangay,
          dropoffLat: b.dropoff.lat,
          dropoffLng: b.dropoff.lng,
          dropoffNotes: b.dropoff.notes,
          packageSize: b.packageSize,
          packageDetails: b.packageDetails,
          distanceKm: price.distanceKm,
          distanceSource: price.distanceSource,
          ...money,
          feePaidBy: b.feePaidBy,
          codAmount: b.codAmount,
          events: { create: { status: 'SEARCHING', actorId: createdById, note: 'Booked' } },
        },
      });
    } catch (err) {
      if (err.code !== 'P2002' || attempt > 4) throw err;
    }
  }

  await alertRiders(job);
  return job;
};

const riderSummary = async (rider) => {
  if (!rider) return null;
  const agg = await prisma.job.aggregate({
    where: { riderId: rider.id, rating: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const done = await prisma.job.count({ where: { riderId: rider.id, status: 'DELIVERED' } });
  return {
    id: rider.id,
    name: rider.user?.fullName,
    phone: rider.user?.phone,
    vehicleType: rider.vehicleType,
    plateNumber: rider.plateNumber,
    todaName: rider.todaName,
    rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    ratingCount: agg._count.rating,
    deliveries: done,
    lat: rider.lastLat,
    lng: rider.lastLng,
    lastSeenAt: rider.lastSeenAt,
  };
};

const jobInclude = {
  town: { select: { id: true, name: true } },
  dropoffTown: { select: { id: true, name: true } },
  promo: { select: { id: true, title: true } },
  rider: { include: { user: { select: { fullName: true, phone: true } } } },
  customer: { select: { id: true, fullName: true, phone: true, email: true } },
  events: { orderBy: { createdAt: 'asc' }, select: { status: true, note: true, createdAt: true } },
};

/**
 * A delivery as `viewer` may see it. A rider looking at an open job they
 * haven't accepted sees where and what, but not the people's phone numbers.
 */
const jobView = async (job, viewer) => {
  const isAdmin = viewer.role === 'ADMIN';
  const isMine = job.customerId === viewer.id;
  const isMyDelivery = Boolean(job.rider && job.rider.userId === viewer.id);
  const preview = !isAdmin && !isMine && !isMyDelivery;
  const view = {
    id: job.id,
    code: job.code,
    status: job.status,
    source: job.source,
    externalCode: job.externalCode,
    town: job.town,
    // The drop-off's town (older jobs: the pickup's).
    dropoffTown: job.dropoffTown || job.town,
    vehicleType: job.vehicleType,
    pickup: {
      name: job.pickupName, phone: preview ? null : job.pickupPhone, address: job.pickupAddress,
      barangay: job.pickupBarangay, lat: job.pickupLat, lng: job.pickupLng, notes: job.pickupNotes,
    },
    dropoff: {
      name: job.dropoffName, phone: preview ? null : job.dropoffPhone, address: job.dropoffAddress,
      barangay: job.dropoffBarangay, lat: job.dropoffLat, lng: job.dropoffLng, notes: job.dropoffNotes,
    },
    packageSize: job.packageSize,
    packageDetails: job.packageDetails,
    distanceKm: num(job.distanceKm),
    // ROAD (by road) or ESTIMATE (the route service was out); null: an older job.
    distanceSource: job.distanceSource || null,
    fee: num(job.fee),
    feePaidBy: job.feePaidBy,
    // A free-delivery promo: fee 0, listFee the usual fee.
    promo: job.promo ? { id: job.promo.id, title: job.promo.title } : null,
    listFee: num(job.listFee),
    codAmount: num(job.codAmount),
    codReturnedAt: job.codReturnedAt,
    pickupPhotoId: preview ? null : job.pickupPhotoId,
    deliveryPhotoId: preview ? null : job.deliveryPhotoId,
    acceptedAt: job.acceptedAt,
    arrivedPickupAt: job.arrivedPickupAt,
    pickedUpAt: job.pickedUpAt,
    arrivedDropoffAt: job.arrivedDropoffAt,
    deliveredAt: job.deliveredAt,
    cancelledAt: job.cancelledAt,
    cancelReason: job.cancelReason,
    failedAt: job.failedAt,
    failReason: job.failReason,
    // Why, from the rider's list (lib/failReasons.js), and whether it was the
    // buyer's fault; failPaid: a failed trip the rider is paid for.
    failCode: job.failCode || null,
    buyerFault: Boolean(job.buyerFault),
    failPaid: Boolean(job.failPaid),
    // A failed E-MOORM delivery: RETURNING until the shop confirms the parcel
    // is back (returnedAt). The rider's task meanwhile is returnTo.
    returnedAt: job.returnedAt || null,
    returnTo: job.status === 'RETURNING'
      ? {
        task: `Return the parcel to ${job.pickupName}`,
        name: job.pickupName,
        phone: preview ? null : job.pickupPhone,
        address: job.pickupAddress,
        barangay: job.pickupBarangay,
        lat: job.pickupLat,
        lng: job.pickupLng,
      }
      : null,
    rating: job.rating,
    ratingComment: job.ratingComment,
    createdAt: job.createdAt,
    events: job.events,
    rider: preview ? null : await riderSummary(job.rider),
  };
  // What the rider takes home; the commission split is the rider's and the
  // admin's business.
  if (isAdmin || isMyDelivery || viewer.role === 'RIDER') {
    view.riderEarning = num(job.riderEarning);
    view.platformCut = num(job.platformCut);
    // A free delivery: MoorMove pays the rider's earning (platformCut is minus it).
    view.moormovePays = num(job.platformCut) < 0 ? -num(job.platformCut) : 0;
    // A failed E-MOORM trip: whether it still pays, and who pays or gets paid back.
    view.tripPay = tripPay(job);
  }
  if (isAdmin) {
    view.customer = job.customer;
    view.settlementId = job.settlementId;
  }
  return view;
};

/** The job, if `viewer` may see it at all. */
const findForViewer = async (id, viewer) => {
  const job = await prisma.job.findUnique({ where: { id: String(id) }, include: jobInclude });
  if (!job) throw new ApiError('Delivery not found', 404);
  if (viewer.role === 'ADMIN' || job.customerId === viewer.id || job.rider?.userId === viewer.id) return job;
  // Riders see open jobs in their area.
  if (viewer.role === 'RIDER' && job.status === 'SEARCHING') {
    const rider = await prisma.rider.findUnique({ where: { userId: viewer.id }, include: { areas: true } });
    if (rider?.status === 'APPROVED' && areas.coversJob(rider, job)) return job;
  }
  throw new ApiError('Delivery not found', 404);
};

/**
 * Move a job from one of `from` to `to`, only if it is still there (so two
 * people acting at once can't both succeed). Logs the step.
 */
const move = async (job, { from, to, data = {}, actorId, note = null, lat = null, lng = null, conflict }) => {
  // A finished job frees its E-MOORM order for a new one.
  const finish = DONE.includes(to) ? { openRef: null } : {};
  const { count } = await prisma.job.updateMany({
    where: { id: job.id, status: { in: from } },
    data: { status: to, ...data, ...finish },
  });
  if (!count) throw new ApiError(conflict || 'This delivery has changed. Pull to refresh.', 409);
  await prisma.jobEvent.create({ data: { jobId: job.id, status: to, actorId, note, lat, lng } });
  const fresh = await prisma.job.findUnique({ where: { id: job.id }, include: jobInclude });
  // E-MOORM hears about every step of its orders.
  if (fresh.source === 'EMOORM') await require('./outbox').jobChanged(fresh);
  return fresh;
};

/**
 * A returning parcel is back with the shop: RETURNING -> FAILED with
 * returnedAt. The buyer's fault: the trip pays the rider like a delivery
 * (failPaid); otherwise it earns nothing.
 */
const closeReturn = (job, { actorId = null, note = 'The parcel is back with the shop' } = {}) => move(job, {
  from: ['RETURNING'],
  to: 'FAILED',
  data: { returnedAt: new Date(), failPaid: job.source === 'EMOORM' && Boolean(job.buyerFault) },
  actorId,
  note,
  conflict: "This delivery's parcel isn't on its way back",
});

const customerLink = (job) => `/deliveries/${job.id}`;

/** Tell the customer (if any) about their delivery. */
const tellCustomer = (job, title, body) => notify(job.customerId, { kind: 'job', title, body, link: customerLink(job) });

const failAlert = (job, reason) => notifyAdmins({
  kind: 'job',
  title: `Delivery ${job.code} couldn't be completed`,
  body: reason,
  link: `/admin/deliveries/${job.id}`,
});

module.exports = {
  ACTIVE, OPEN, DONE, VEHICLES, SIZES,
  createJob, jobView, findForViewer, move, closeReturn, jobInclude, riderSummary, tellCustomer, failAlert, num,
  paidWhere, doneAt, tripPay,
  canTake, fitsVehicle, vehiclesFor, takeableBy, alertRiders, newCode,
};
