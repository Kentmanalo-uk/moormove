const express = require('express');
const prisma = require('../lib/prisma');
const emoorm = require('../lib/emoorm');
const { townCenter } = require('../lib/geo');
const { authenticate, allow } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');

const router = express.Router();

const withCenter = (t) => ({ ...t, center: townCenter(t.name) });

/** Towns, with where to open the map. ?all=1 (admins): closed ones too. */
router.get('/', async (req, res) => {
  const towns = await prisma.town.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, serviceOpen: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: towns.map(withCenter) });
});

/**
 * Copy E-MOORM's towns (its municipalities, through its API). Towns E-MOORM
 * no longer lists are turned off here, never deleted: riders may belong to them.
 */
router.post('/sync', authenticate, allow('ADMIN'), async (req, res) => {
  const fromEmoorm = await emoorm.municipalities();
  const now = new Date();
  await prisma.$transaction([
    ...fromEmoorm.map((t) => prisma.town.upsert({
      where: { id: t.id },
      create: { id: t.id, name: t.name, code: t.code, isActive: t.isActive, syncedAt: now },
      update: { name: t.name, code: t.code, isActive: t.isActive, syncedAt: now },
    })),
    prisma.town.updateMany({
      where: { id: { notIn: fromEmoorm.map((t) => t.id) } },
      data: { isActive: false },
    }),
  ]);
  res.json({ success: true, data: { count: fromEmoorm.length, syncedAt: now } });
});

/** Open or close bookings in a town. */
router.patch('/:id', authenticate, allow('ADMIN'), async (req, res) => {
  if (typeof req.body?.serviceOpen !== 'boolean') throw new ApiError('Say whether the town is open', 400);
  const town = await prisma.town.findUnique({ where: { id: String(req.params.id) } });
  if (!town) throw new ApiError('Town not found', 404);
  const updated = await prisma.town.update({ where: { id: town.id }, data: { serviceOpen: req.body.serviceOpen } });
  res.json({ success: true, data: withCenter(updated) });
});

module.exports = router;
