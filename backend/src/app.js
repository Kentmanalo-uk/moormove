const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.nodeEnv === 'production' ? 1 : false);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      // Map tiles come from OpenStreetMap; private photos are shown as blobs.
      'img-src': ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
    },
  },
}));
app.use(cors({ origin: config.webOrigin }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ success: true, data: { app: 'moormove', ok: true } }));
// How to reach MoorMove (help pages, before signing in too).
app.get('/api/info', async (req, res) => {
  const s = await require('./lib/settings').get();
  const fromFare = Object.fromEntries(Object.entries(s.vehicles).map(([v, f]) => [v, Number(f.base)]));
  res.json({
    success: true,
    data: { supportPhone: s.supportPhone, supportEmail: s.supportEmail, bookingOpen: s.bookingOpen, publicBooking: Boolean(s.publicBooking), fromFare },
  });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/towns', require('./routes/towns'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/rider', require('./routes/rider'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/partner', require('./routes/partner'));

// The web app (move.emoorm.shop runs as one app): its files, and index.html
// for every other page so the app's own routes work on reload.
const WEB = path.join(__dirname, '..', '..', 'web', 'dist');
if (config.serveWeb && fs.existsSync(path.join(WEB, 'index.html'))) {
  app.use(express.static(WEB, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api(\/|$)).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(WEB, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
