const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');
const settingsLib = require('../lib/settings');
const { signToken, authenticate } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');
const { text, phone, isPhone, isEmail, failIf } = require('../lib/check');

const router = express.Router();

// Slows down password guessing: 20 tries per 15 minutes per address.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many tries. Please wait a few minutes.' },
});

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phone: user.phone,
  role: user.role,
  createdAt: user.createdAt,
});

/**
 * A new account: a customer (books deliveries) or a rider (applies to
 * deliver). Admins are made with `npm run create-admin`.
 */
router.post('/register', limiter, async (req, res) => {
  const role = req.body?.role === 'RIDER' ? 'RIDER' : 'CUSTOMER';
  if (role === 'CUSTOMER' && !(await settingsLib.get()).publicBooking) {
    throw new ApiError("MoorMove isn't open to customers yet", 403);
  }
  const fullName = text(req.body?.fullName, 120);
  const email = text(req.body?.email, 160).toLowerCase();
  const mobile = phone(req.body?.phone);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const errors = {};
  if (fullName.length < 2) errors.fullName = 'Enter your full name';
  if (!isEmail(email)) errors.email = 'Enter a valid email address';
  if (!isPhone(mobile)) errors.phone = 'Enter your mobile number, like 09171234567';
  if (password.length < 8) errors.password = 'Use at least 8 characters';
  failIf(errors);

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new ApiError('An account with this email already exists. Sign in instead.', 409, {
      email: 'This email already has an account',
    });
  }

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      phone: mobile,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      lastLoginAt: new Date(),
      ...(role === 'RIDER' ? { rider: { create: {} } } : {}),
    },
  });
  res.status(201).json({ success: true, data: { token: signToken(user), user: publicUser(user) } });
});

router.post('/login', limiter, async (req, res) => {
  const email = text(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  // The same answer for an unknown email and a wrong password.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError('Wrong email or password', 401);
  }
  if (!user.isActive) throw new ApiError('This account is turned off. Contact MoorMove support.', 403);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  res.json({ success: true, data: { token: signToken(user), user: publicUser(user) } });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
});

router.put('/me', authenticate, async (req, res) => {
  const fullName = text(req.body?.fullName, 120);
  const mobile = phone(req.body?.phone);
  const errors = {};
  if (fullName.length < 2) errors.fullName = 'Enter your full name';
  if (!isPhone(mobile)) errors.phone = 'Enter your mobile number, like 09171234567';
  failIf(errors);
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { fullName, phone: mobile } });
  res.json({ success: true, data: publicUser(user) });
});

router.put('/password', authenticate, limiter, async (req, res) => {
  const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!(await bcrypt.compare(current, req.user.passwordHash))) {
    throw new ApiError('Your current password is wrong', 422, { currentPassword: 'Wrong password' });
  }
  if (next.length < 8) throw new ApiError('Use at least 8 characters', 422, { newPassword: 'Use at least 8 characters' });
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  res.json({ success: true, data: { changed: true } });
});

module.exports = router;
module.exports.publicUser = publicUser;
