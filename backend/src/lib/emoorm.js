/**
 * E-MOORM, read only, through its public API. MoorMove never writes to
 * E-MOORM and never touches its database.
 */
const config = require('../config/env');
const { ApiError } = require('../middleware/errors');

const get = async (path) => {
  let res;
  try {
    res = await fetch(`${config.emoormApiUrl}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError('E-MOORM could not be reached. Try again in a moment.', 502);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new ApiError(`E-MOORM answered ${res.status}${body?.message ? `: ${body.message}` : ''}`, 502);
  }
  return body.data;
};

/** E-MOORM's towns: [{ id, name, code, isActive }]. */
const municipalities = async () => {
  const data = await get('/municipalities');
  if (!Array.isArray(data)) throw new ApiError('E-MOORM sent an unexpected list of towns', 502);
  return data.map(({ id, name, code, isActive }) => ({ id, name, code, isActive: isActive !== false }));
};

module.exports = { municipalities };
