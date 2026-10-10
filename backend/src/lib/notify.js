/**
 * In-app notifications. Failing to notify never fails what caused it.
 */
const prisma = require('./prisma');

/**
 * @param {String|String[]} userIds
 * @param {{ kind: String, title: String, body: String, link?: String }} message
 */
const notify = async (userIds, { kind, title, body, link = null }) => {
  const ids = [...new Set([].concat(userIds).filter(Boolean))];
  if (!ids.length) return;
  try {
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, kind, title: title.slice(0, 160), body: body.slice(0, 500), link })),
    });
  } catch (err) {
    console.error('notify failed', err.message);
  }
};

const notifyAdmins = async (message) => {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  await notify(admins.map((a) => a.id), message);
};

module.exports = { notify, notifyAdmins };
