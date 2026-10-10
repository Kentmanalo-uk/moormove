require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see moormove/backend/.env.example)`);
  return value;
};

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

// The secret E-MOORM and MoorMove share (E-MOORM calls it MOORMOVE_SECRET).
// Without it the partner API answers 503 and no updates are sent.
const partnerSecret = process.env.PARTNER_SECRET || '';
if (partnerSecret && partnerSecret.length < 32) throw new Error('PARTNER_SECRET must be at least 32 characters');

const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  nodeEnv,
  port: Number(process.env.PORT) || 4000,
  jwtSecret,
  jwtExpiresIn: '7d',
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5174',
  emoormApiUrl: (process.env.EMOORM_API_URL || 'http://localhost:3000/api').replace(/\/$/, ''),
  // Riders' documents and proof photos. On Hostinger this must be a folder
  // OUTSIDE the app (a redeploy replaces the app folder), e.g.
  // /home/<user>/moormove-data/uploads. Default: backend/uploads.
  uploadDir: require('path').resolve(process.env.UPLOAD_DIR || require('path').join(__dirname, '..', '..', 'uploads')),
  partnerSecret,
  // One app for move.emoorm.shop: the API also serves the built web app
  // (web/dist). On in production, or with SERVE_WEB=1.
  serveWeb: nodeEnv === 'production' || process.env.SERVE_WEB === '1',
  // Run `prisma migrate deploy` once the server is listening (production, or
  // MIGRATE_ON_START=1).
  migrateOnStart: nodeEnv === 'production' || process.env.MIGRATE_ON_START === '1',
};
