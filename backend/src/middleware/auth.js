const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../lib/prisma');
const { ApiError } = require('./errors');

const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
  expiresIn: config.jwtExpiresIn,
});

/** Signed in: req.user is the account (active ones only). */
const authenticate = async (req, res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError('Please sign in', 401);
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new ApiError('Your session has ended. Please sign in again.', 401);
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw new ApiError('Your session has ended. Please sign in again.', 401);
  req.user = user;
  next();
};

/** Only these roles, after authenticate. */
const allow = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) throw new ApiError('You are not allowed to do that', 403);
  next();
};

module.exports = { signToken, authenticate, allow };
