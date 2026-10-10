/**
 * MoorMove's settings: fares, commission and booking rules. Stored as one
 * row; anything missing falls back to the defaults below, so a new setting
 * never needs a migration.
 */
const prisma = require('./prisma');

const DEFAULTS = {
  // Fare = base + perKm for every km past includedKm + the size surcharge.
  vehicles: {
    TRICYCLE: { base: 50, perKm: 10 },
    MOTORCYCLE: { base: 40, perKm: 8 },
    BICYCLE: { base: 30, perKm: 8 },
  },
  includedKm: 2,
  sizeSurcharge: { SMALL: 0, MEDIUM: 10, LARGE: 30 },
  // Straight-line distance times this, for the roads in between.
  roadFactor: 1.3,
  maxDistanceKm: 30,
  // MoorMove's share of each fee, in percent. The rest is the rider's.
  commissionPercent: 10,
  // Most COD a rider is asked to carry.
  maxCod: 5000,
  bookingOpen: true,
  // Take deliveries for E-MOORM orders (shops call a rider from E-MOORM).
  partnerOpen: true,
  // Let people sign up as customers and book deliveries on MoorMove itself.
  // Off: MoorMove carries E-MOORM orders only.
  publicBooking: false,
  supportPhone: '',
  supportEmail: '',
};

// Which package sizes each vehicle carries.
const CARRIES = {
  BICYCLE: ['SMALL'],
  MOTORCYCLE: ['SMALL', 'MEDIUM'],
  TRICYCLE: ['SMALL', 'MEDIUM', 'LARGE'],
};

const merge = (stored) => {
  const s = stored && typeof stored === 'object' ? stored : {};
  return {
    ...DEFAULTS,
    ...s,
    vehicles: Object.fromEntries(Object.keys(DEFAULTS.vehicles).map((v) => [
      v, { ...DEFAULTS.vehicles[v], ...(s.vehicles?.[v] || {}) },
    ])),
    sizeSurcharge: { ...DEFAULTS.sizeSurcharge, ...(s.sizeSurcharge || {}) },
  };
};

const get = async () => merge((await prisma.setting.findUnique({ where: { id: 1 } }))?.data);

const save = async (data) => {
  const merged = merge(data);
  await prisma.setting.upsert({ where: { id: 1 }, create: { id: 1, data: merged }, update: { data: merged } });
  return merged;
};

module.exports = { DEFAULTS, CARRIES, get, save, merge };
