/** Money, dates and the names shown for statuses, vehicles and sizes. */

export const peso = (n, { cents = false } = {}) => {
  const v = Number(n) || 0;
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : (Number.isInteger(v) ? 0 : 2) })}`;
};

/** "1 delivery", "3 deliveries". */
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const km = (n) => `${(Number(n) || 0).toLocaleString('en-PH', { maximumFractionDigits: 1 })} km`;

export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const date = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
export const time = (d) => (d ? new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '');

export const ago = (d) => {
  if (!d) return '';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return date(d);
};

export const VEHICLES = {
  TRICYCLE: 'Tricycle',
  MOTORCYCLE: 'Motorcycle',
  BICYCLE: 'Bicycle / e-bike',
};

export const SIZES = {
  SMALL: { label: 'Small', hint: 'Fits in a bag: documents, food, medicine', max: 'up to 5 kg' },
  MEDIUM: { label: 'Medium', hint: 'A box: shoes, groceries, small appliances', max: 'up to 20 kg' },
  LARGE: { label: 'Large', hint: 'Sacks of rice, furniture parts, big boxes', max: 'up to 50 kg' },
};

/** What a delivery's status means, for each side. */
export const JOB_STATUS = {
  SEARCHING: { label: 'Finding a rider', tone: 'amber', customer: 'Finding you a rider…', rider: 'Open' },
  ACCEPTED: { label: 'Rider on the way', tone: 'blue', customer: 'Your rider is heading to the pickup', rider: 'Head to the pickup' },
  AT_PICKUP: { label: 'At pickup', tone: 'blue', customer: 'Your rider is at the pickup', rider: 'Pick up the package' },
  PICKED_UP: { label: 'On the way', tone: 'blue', customer: 'Your package is on the way', rider: 'Deliver the package' },
  AT_DROPOFF: { label: 'Arrived', tone: 'blue', customer: 'Your rider has arrived at the drop-off', rider: 'Hand over the package' },
  DELIVERED: { label: 'Delivered', tone: 'green', customer: 'Delivered', rider: 'Delivered' },
  CANCELLED: { label: 'Cancelled', tone: 'grey', customer: 'Cancelled', rider: 'Cancelled' },
  // An E-MOORM parcel that couldn't be delivered, on its way back to the shop.
  RETURNING: { label: 'Returning', tone: 'amber', customer: 'Coming back to the sender', rider: 'Return the parcel' },
  FAILED: { label: 'Not delivered', tone: 'red', customer: "Couldn't be delivered", rider: 'Not delivered' },
};

/**
 * Why a rider couldn't deliver. On an E-MOORM order, the buyer's fault means
 * the rider is still paid for the trip. OTHER needs a note.
 */
export const FAIL_REASONS = [
  { code: 'BUYER_REFUSED', label: 'Buyer refused the parcel', buyerFault: true },
  { code: 'BUYER_UNREACHABLE', label: "Buyer not there / didn't answer", buyerFault: true },
  { code: 'WRONG_ADDRESS', label: 'Wrong address or pin', buyerFault: true },
  { code: 'PARCEL_DAMAGED', label: 'Parcel damaged', buyerFault: false },
  { code: 'WRONG_ITEM', label: 'Wrong or missing item', buyerFault: false },
  { code: 'RIDER_PROBLEM', label: 'Rider problem (vehicle, accident)', buyerFault: false },
  { code: 'OTHER', label: 'Other', buyerFault: false },
];

/** The fail reason for a code, or null (old jobs have none). */
export const failReasonOf = (code) => FAIL_REASONS.find((r) => r.code === code) || null;

export const RIDER_STATUS = {
  DRAFT: { label: 'Not sent yet', tone: 'grey' },
  PENDING: { label: 'Under review', tone: 'amber' },
  NEEDS_CHANGES: { label: 'Needs changes', tone: 'amber' },
  APPROVED: { label: 'Approved', tone: 'green' },
  REJECTED: { label: 'Not approved', tone: 'red' },
  SUSPENDED: { label: 'Suspended', tone: 'red' },
};

// RETURNING is still the rider's job (bring the parcel back) until the shop confirms.
export const ACTIVE = ['ACCEPTED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'RETURNING'];

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export const telLink = (phone) => `tel:${phone}`;
export const smsLink = (phone) => `sms:${phone}`;
export const mapsLink = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
