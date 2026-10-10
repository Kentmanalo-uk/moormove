const { haversineKm } = require('./geo');
const { CARRIES } = require('./settings');

const peso = (n) => Math.round(n);
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * What a delivery costs, from the two pins.
 * @returns {{ distanceKm, fee, platformCut, riderEarning, breakdown }}
 */
const quote = (settings, { vehicleType, packageSize, pickup, dropoff }) => {
  const v = settings.vehicles[vehicleType];
  const distanceKm = round2(haversineKm(pickup, dropoff) * settings.roadFactor);
  const extraKm = Math.max(0, distanceKm - settings.includedKm);
  const distanceFare = peso(extraKm * v.perKm);
  const surcharge = peso(settings.sizeSurcharge[packageSize] || 0);
  const fee = peso(v.base) + distanceFare + surcharge;
  const platformCut = round2((fee * settings.commissionPercent) / 100);
  return {
    distanceKm,
    fee,
    platformCut,
    riderEarning: round2(fee - platformCut),
    breakdown: { base: peso(v.base), includedKm: settings.includedKm, extraKm: round2(extraKm), distanceFare, surcharge },
  };
};

const carries = (vehicleType, packageSize) => (CARRIES[vehicleType] || []).includes(packageSize);

module.exports = { quote, carries };
