/**
 * Map helpers. Town centres are approximate (the town proper of each
 * Oriental Mindoro municipality) and only used to open the map in the right
 * place; distances come from the pins people drop.
 */
const CENTERS = [
  ['puerto galera', 13.505, 120.954],
  ['san teodoro', 13.436, 121.019],
  ['baco', 13.358, 121.098],
  ['calapan', 13.411, 121.18],
  ['naujan', 13.324, 121.302],
  ['victoria', 13.177, 121.277],
  ['socorro', 13.058, 121.411],
  ['pola', 13.144, 121.44],
  ['pinamalayan', 13.036, 121.488],
  ['gloria', 12.973, 121.478],
  ['bansud', 12.861, 121.457],
  ['bongabong', 12.746, 121.488],
  ['roxas', 12.586, 121.522],
  ['mansalay', 12.52, 121.438],
  ['bulalacao', 12.326, 121.343],
];
// Oriental Mindoro's capital, when a town isn't known.
const FALLBACK = { lat: 13.411, lng: 121.18 };

const townCenter = (name) => {
  const n = String(name || '').toLowerCase();
  const hit = CENTERS.find(([key]) => n.includes(key));
  return hit ? { lat: hit[1], lng: hit[2] } : FALLBACK;
};

/** Straight-line distance in km. */
const haversineKm = (a, b) => {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Roughly Oriental Mindoro and its islands: pins outside are mistakes.
const inProvince = ({ lat, lng }) => lat > 12.1 && lat < 13.75 && lng > 120.7 && lng < 121.8;

const isPoint = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

module.exports = { townCenter, haversineKm, inProvince, isPoint };
