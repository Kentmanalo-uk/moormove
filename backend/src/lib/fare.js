const { roadDistance } = require('./routing');
const { CARRIES } = require('./settings');

const peso = (n) => Math.round(n);
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * What a delivery costs, from the two pins: the km by road from pickup to
 * drop-off (lib/routing.js; when the route service is out, an estimate: the
 * straight line × settings.roadFactor), then base + perKm for every km past
 * includedKm + the size surcharge, by the vehicle's settings.
 * @returns {Promise<{ distanceKm, distanceSource: 'ROAD'|'ESTIMATE', minutes, fee, platformCut, riderEarning, breakdown }>}
 */
const quote = async (settings, { vehicleType, packageSize, pickup, dropoff }) => {
  const v = settings.vehicles[vehicleType];
  const road = await roadDistance(pickup, dropoff, { roadFactor: settings.roadFactor });
  const distanceKm = round2(road.km);
  const extraKm = Math.max(0, distanceKm - settings.includedKm);
  const distanceFare = peso(extraKm * v.perKm);
  const surcharge = peso(settings.sizeSurcharge[packageSize] || 0);
  const fee = peso(v.base) + distanceFare + surcharge;
  const platformCut = round2((fee * settings.commissionPercent) / 100);
  return {
    distanceKm,
    distanceSource: road.source,
    minutes: road.minutes,
    fee,
    platformCut,
    riderEarning: round2(fee - platformCut),
    breakdown: { base: peso(v.base), includedKm: settings.includedKm, extraKm: round2(extraKm), distanceFare, surcharge },
  };
};

const carries = (vehicleType, packageSize) => (CARRIES[vehicleType] || []).includes(packageSize);

module.exports = { quote, carries };
