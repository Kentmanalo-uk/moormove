/**
 * Photos (riders' documents for now). Stored in UPLOAD_DIR (backend/uploads/
 * by default), outside any
 * public folder, and served only to the person who uploaded them and to admins:
 * IDs and licences must never be reachable by link alone.
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');

const router = express.Router();
const DIR = require('../config/env').uploadDir;
fs.mkdirSync(DIR, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

// What the file really is, from its first bytes (not from its name or the
// type the browser claims).
const sniff = (buf) => {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: '.png' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: '.webp' };
  return null;
};

router.post('/', authenticate, upload.single('photo'), async (req, res) => {
  if (!req.file) throw new ApiError('Choose a photo to upload', 400);
  const kind = sniff(req.file.buffer);
  if (!kind) throw new ApiError('Upload a photo (JPG, PNG or WebP)', 400);
  const fileName = `${crypto.randomUUID()}${kind.ext}`;
  await fs.promises.writeFile(path.join(DIR, fileName), req.file.buffer);
  const row = await prisma.upload.create({
    data: { userId: req.user.id, fileName, mimeType: kind.mime, size: req.file.size },
  });
  res.status(201).json({ success: true, data: { id: row.id } });
});

/**
 * Who may see a photo: whoever uploaded it, admins, and for proof of pickup
 * or delivery, the customer who booked that delivery.
 */
const maySee = async (row, user) => {
  if (row.userId === user.id || user.role === 'ADMIN') return true;
  const job = await prisma.job.findFirst({
    where: { OR: [{ pickupPhotoId: row.id }, { deliveryPhotoId: row.id }] },
    select: { customerId: true },
  });
  return Boolean(job && job.customerId === user.id);
};

router.get('/:id', authenticate, async (req, res) => {
  const row = await prisma.upload.findUnique({ where: { id: String(req.params.id) } });
  if (!row || !(await maySee(row, req.user))) {
    throw new ApiError('Photo not found', 404);
  }
  res.set({
    'Content-Type': row.mimeType,
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  res.sendFile(path.join(DIR, row.fileName));
});

module.exports = router;
