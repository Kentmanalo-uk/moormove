/**
 * The partner API for E-MOORM: its server books riders for its shops'
 * orders, follows them and cancels them. Only E-MOORM's server calls this,
 * with the shared secret (Authorization: Bearer <PARTNER_SECRET>).
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const prisma = require('../lib/prisma');
const settingsLib = require('../lib/settings');
const { text } = require('../lib/check');
const { notify } = require('../lib/notify');
const { ApiError } = require('../middleware/errors');
const jobs = require('../lib/jobs');
const partner = require('../lib/partner');
const outbox = require('../lib/outbox');

const router = express.Router();
const UPLOADS = require('../config/env').uploadDir;

// Generous: one server calling, but never unlimited.
router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Slow down a little.' },
}));

// Compares hashes, so the time taken says nothing about the secret (not
// even its length).
const sameSecret = (given, secret) => crypto.timingSafeEqual(
  crypto.createHash('sha256').update(given).digest(),
  crypto.createHash('sha256').update(secret).digest(),
);

router.use((req, res, next) => {
  if (!config.partnerSecret) throw new ApiError('The E-MOORM link is not set up on MoorMove', 503);
  const header = req.get('authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!given || !sameSecret(given, config.partnerSecret)) throw new ApiError('Not allowed', 401);
  next();
});

/** Is MoorMove taking E-MOORM orders, and where. */
router.get('/status', async (req, res) => {
  const s = await settingsLib.get();
  const towns = await prisma.town.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, serviceOpen: true },
  });
  res.json({
    success: true,
    data: { open: Boolean(s.partnerOpen && s.bookingOpen), towns, maxDistanceKm: s.maxDistanceKm, maxCod: s.maxCod },
  });
});

/** What a rider would cost for an order, or why MoorMove can't take it. */
router.post('/quote', async (req, res) => {
  const { available, reason, vehicleType, distanceKm, fee } = await partner.quoteOrder(req.body || {});
  res.json({ success: true, data: { available, reason, vehicleType, distanceKm, fee } });
});

/** Book a rider for an order. The same order twice gives back the open job. */
router.post('/jobs', async (req, res) => {
  const { job, created } = await partner.createOrderJob(req.body);
  res.status(created ? 201 : 200).json({ success: true, data: { job: await partner.partnerView(job) } });
});

router.get('/jobs/:id', async (req, res) => {
  const job = await partner.findOrderJob(req.params.id);
  res.json({ success: true, data: await partner.partnerView(job) });
});

/** The shop cancels, until the rider has the parcel. */
router.post('/jobs/:id/cancel', async (req, res) => {
  const job = await partner.findOrderJob(req.params.id);
  // Asking twice is fine.
  if (job.status === 'CANCELLED') return res.json({ success: true, data: await partner.partnerView(job) });
  const reason = text(req.body?.reason, 255) || 'Cancelled by the shop';
  const updated = await jobs.move(job, {
    from: ['SEARCHING', 'ACCEPTED', 'AT_PICKUP'],
    to: 'CANCELLED',
    data: { cancelledAt: new Date(), cancelReason: reason },
    actorId: null,
    note: `Cancelled on E-MOORM: ${reason}`,
    conflict: 'The rider already has the parcel',
  });
  if (job.rider) {
    await notify(job.rider.userId, {
      kind: 'job', title: `Delivery ${job.code} was cancelled`, body: `The shop cancelled: ${reason}`, link: `/rider/jobs/${job.id}`,
    });
  }
  res.json({ success: true, data: await partner.partnerView(updated) });
});

/** The seller confirmed getting the COD cash from the rider. */
router.post('/jobs/:id/cod-returned', async (req, res) => {
  const job = await partner.findOrderJob(req.params.id);
  if (job.status !== 'DELIVERED' || Number(job.codAmount) <= 0) throw new ApiError('There is no COD to confirm', 409);
  if (job.codReturnedAt) return res.json({ success: true, data: await partner.partnerView(job) });
  const { count } = await prisma.job.updateMany({ where: { id: job.id, codReturnedAt: null }, data: { codReturnedAt: new Date() } });
  const fresh = await prisma.job.findUnique({ where: { id: job.id }, include: jobs.jobInclude });
  if (count) {
    await outbox.jobChanged(fresh);
    if (job.rider) {
      await notify(job.rider.userId, {
        kind: 'cash',
        title: 'Seller confirmed the cash',
        body: `${job.pickupName} got the ₱${Number(job.codAmount).toFixed(0)} for ${job.externalCode ? `order #${job.externalCode}` : job.code}. Thank you!`,
        link: `/rider/jobs/${job.id}`,
      });
    }
  }
  res.json({ success: true, data: await partner.partnerView(fresh) });
});

/** A proof photo (pickup or delivery) of an E-MOORM job. */
router.get('/uploads/:uploadId', async (req, res) => {
  const id = String(req.params.uploadId);
  const job = await prisma.job.findFirst({
    where: { source: 'EMOORM', OR: [{ pickupPhotoId: id }, { deliveryPhotoId: id }] },
    select: { id: true },
  });
  const row = job ? await prisma.upload.findUnique({ where: { id } }) : null;
  const file = row && path.join(UPLOADS, row.fileName);
  if (!row || !fs.existsSync(file)) throw new ApiError('Photo not found', 404);
  res.set({ 'Content-Type': row.mimeType, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
  res.sendFile(file);
});

module.exports = router;
