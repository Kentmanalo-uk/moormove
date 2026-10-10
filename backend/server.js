const path = require('path');
const { spawn } = require('child_process');
const config = require('./src/config/env');
const app = require('./src/app');
const prisma = require('./src/lib/prisma');
const outbox = require('./src/lib/outbox');

/**
 * Bring the database up to date (`prisma migrate deploy`) without holding up
 * the server: on Hostinger the app must answer quickly after a deploy.
 */
const migrate = () => {
  let cli;
  try {
    cli = require.resolve('prisma/build/index.js');
  } catch {
    console.error('Prisma CLI not installed: run `npx prisma migrate deploy` in moormove/backend by hand.');
    return;
  }
  const child = spawn(process.execPath, [cli, 'migrate', 'deploy'], {
    cwd: __dirname,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => {
    if (code === 0) console.log('Database is up to date.');
    else console.error(`prisma migrate deploy failed (${code}):\n${out.slice(-2000)}`);
  });
};

const server = app.listen(config.port, () => {
  console.log(`MoorMove API on http://localhost:${config.port}/api`);
  if (config.serveWeb) console.log(`Web app served from ${path.join(__dirname, '..', 'web', 'dist')}`);
  if (config.migrateOnStart) migrate();
});

// Updates for E-MOORM, sent every few seconds.
const stopOutbox = outbox.start();

const stop = async () => {
  stopOutbox();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
