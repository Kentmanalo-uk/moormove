const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const list = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: list });
});

router.get('/unread-count', async (req, res) => {
  const count = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
  res.json({ success: true, data: { count } });
});

router.put('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ success: true, data: { ok: true } });
});

router.put('/:id/read', async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: String(req.params.id), userId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ success: true, data: { ok: true } });
});

router.delete('/', async (req, res) => {
  await prisma.notification.deleteMany({ where: { userId: req.user.id, readAt: { not: null } } });
  res.json({ success: true, data: { ok: true } });
});

module.exports = router;
