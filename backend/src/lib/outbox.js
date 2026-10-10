/**
 * Updates for E-MOORM about its orders' deliveries. Every change is first
 * saved in partner_events (an outbox), then a small loop posts them to
 * E-MOORM, signed with the shared secret, oldest first for each job, and
 * tries again later when E-MOORM doesn't answer. A lost update can't happen:
 * at worst it arrives late (E-MOORM also checks open jobs every 2 minutes).
 */
const crypto = require('crypto');
const prisma = require('./prisma');
const config = require('../config/env');
const { notifyAdmins } = require('./notify');

const EVERY_MS = 5000;
// Wait before the 1st, 2nd, ... retry (seconds); after that every 30 minutes.
const BACKOFF = [10, 30, 60, 5 * 60, 15 * 60];
const LATER = 30 * 60;
const GIVE_UP_MS = 24 * 3600 * 1000;
const KEEP_MS = 7 * 24 * 3600 * 1000;
const PRUNE_EVERY_MS = 3600 * 1000;

/** Queue an update about `job` (with its rider). Never fails the caller. */
const jobChanged = async (job, type = 'job.updated') => {
  try {
    const view = await require('./partner').partnerView(job);
    await prisma.partnerEvent.create({ data: { jobId: job.id, type, payload: { type, job: view } } });
  } catch (err) {
    console.error('Could not queue the E-MOORM update', err.message);
  }
};

/** sha256=<hex HMAC of "timestamp.body"> with the shared secret. */
const sign = (timestamp, body) => `sha256=${crypto.createHmac('sha256', config.partnerSecret).update(`${timestamp}.${body}`).digest('hex')}`;

const post = async (event) => {
  const body = JSON.stringify({ id: event.id, ...event.payload });
  const timestamp = String(Math.floor(Date.now() / 1000));
  let res;
  try {
    res = await fetch(`${config.emoormApiUrl}/partner/moormove/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MoorMove-Event': event.id,
        'X-MoorMove-Timestamp': timestamp,
        'X-MoorMove-Signature': sign(timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    throw new Error(`E-MOORM could not be reached (${err.cause?.code || err.name || 'network error'})`);
  }
  if (!res.ok) {
    const answer = await res.text().catch(() => '');
    throw new Error(`E-MOORM answered ${res.status}${answer ? `: ${answer.slice(0, 160)}` : ''}`);
  }
};

const failed = async (event, err) => {
  const attempts = event.attempts + 1;
  const lastError = String(err.message || err).slice(0, 255);
  if (Date.now() - event.createdAt.getTime() >= GIVE_UP_MS) {
    await prisma.partnerEvent.update({ where: { id: event.id }, data: { attempts, lastError, gaveUpAt: new Date() } });
    const job = await prisma.job.findUnique({ where: { id: event.jobId }, select: { code: true, externalCode: true } });
    await notifyAdmins({
      kind: 'system',
      title: "E-MOORM didn't get an update",
      body: `${job?.code || 'A delivery'}${job?.externalCode ? ` (order #${job.externalCode})` : ''}: tried for a day. ${lastError}`,
      link: `/admin/deliveries/${event.jobId}`,
    });
    return;
  }
  const wait = BACKOFF[attempts - 1] ?? LATER;
  await prisma.partnerEvent.update({
    where: { id: event.id },
    data: { attempts, lastError, nextAttemptAt: new Date(Date.now() + wait * 1000) },
  });
};

let running = false;
let lastPrune = 0;

/** One round: send what is due, oldest first; a job's later updates wait for its earlier ones. */
const tick = async () => {
  if (running || !config.partnerSecret) return;
  running = true;
  try {
    const waiting = await prisma.partnerEvent.findMany({
      where: { sentAt: null, gaveUpAt: null },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const held = new Set();
    for (const event of waiting) {
      if (held.has(event.jobId)) continue;
      if (event.nextAttemptAt > new Date()) {
        held.add(event.jobId);
        continue;
      }
      try {
        await post(event);
        await prisma.partnerEvent.update({ where: { id: event.id }, data: { sentAt: new Date(), attempts: event.attempts + 1 } });
      } catch (err) {
        held.add(event.jobId);
        await failed(event, err);
      }
    }
    if (Date.now() - lastPrune > PRUNE_EVERY_MS) {
      lastPrune = Date.now();
      await prisma.partnerEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } } });
    }
  } catch (err) {
    console.error('Sending E-MOORM updates failed', err.message);
  } finally {
    running = false;
  }
};

/** Start the loop (from server.js). Returns a function that stops it. */
const start = () => {
  if (!config.partnerSecret) {
    console.log('PARTNER_SECRET is not set: E-MOORM updates are kept but not sent.');
  }
  const timer = setInterval(tick, EVERY_MS);
  return () => clearInterval(timer);
};

/** For the admin: is the link set up, and is E-MOORM getting its updates? */
const status = async () => {
  const [waiting, failing, gaveUp, lastSent] = await Promise.all([
    prisma.partnerEvent.count({ where: { sentAt: null, gaveUpAt: null } }),
    prisma.partnerEvent.findFirst({
      where: { sentAt: null, lastError: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: { job: { select: { id: true, code: true, externalCode: true } } },
    }),
    prisma.partnerEvent.count({ where: { gaveUpAt: { not: null } } }),
    prisma.partnerEvent.findFirst({ where: { sentAt: { not: null } }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } }),
  ]);
  return {
    secretSet: Boolean(config.partnerSecret),
    emoormApiUrl: config.emoormApiUrl,
    waiting,
    gaveUp,
    lastSentAt: lastSent?.sentAt || null,
    lastError: failing ? {
      message: failing.lastError,
      since: failing.createdAt,
      nextTryAt: failing.gaveUpAt ? null : failing.nextAttemptAt,
      attempts: failing.attempts,
      gaveUp: Boolean(failing.gaveUpAt),
      job: failing.job,
    } : null,
  };
};

module.exports = { jobChanged, sign, tick, start, status };
