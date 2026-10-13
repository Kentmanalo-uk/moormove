/**
 * Why a delivery couldn't be completed: the rider picks one from this list
 * (with a note when it's OTHER). The first three are the buyer's fault: an
 * E-MOORM trip that failed that way still pays the rider, and E-MOORM charges
 * the buyer the delivery fee for it.
 */
const { text } = require('./check');
const { ApiError } = require('../middleware/errors');

const FAIL_REASONS = [
  { code: 'BUYER_REFUSED', label: 'Buyer refused the parcel', buyerFault: true },
  { code: 'BUYER_UNREACHABLE', label: "Buyer not there / didn't answer", buyerFault: true },
  { code: 'WRONG_ADDRESS', label: 'Wrong address or pin', buyerFault: true },
  { code: 'PARCEL_DAMAGED', label: 'Parcel damaged', buyerFault: false },
  { code: 'WRONG_ITEM', label: 'Wrong or missing item', buyerFault: false },
  { code: 'RIDER_PROBLEM', label: 'Rider problem (vehicle, accident)', buyerFault: false },
  { code: 'OTHER', label: 'Other', buyerFault: false },
];
const BY_CODE = new Map(FAIL_REASONS.map((r) => [r.code, r]));

/**
 * Read the rider's { reasonCode, note } (or an older app's free-text
 * { reason }, taken as OTHER): { failCode, buyerFault, failReason }, where
 * failReason is the readable text (the label, plus " · note").
 */
const readFail = (body) => {
  const b = body || {};
  const note = text(b.note, 255);
  if (!b.reasonCode && b.reason !== undefined) {
    const reason = text(b.reason, 255);
    if (!reason) throw new ApiError('Tell us what happened', 422, { reason: 'Required' });
    return { failCode: 'OTHER', buyerFault: false, failReason: reason };
  }
  const reason = BY_CODE.get(String(b.reasonCode || '').toUpperCase());
  if (!reason) throw new ApiError('Choose what happened', 422, { reasonCode: 'Required' });
  if (reason.code === 'OTHER') {
    if (!note) throw new ApiError('Say what happened', 422, { note: 'Required' });
    return { failCode: 'OTHER', buyerFault: false, failReason: `Other · ${note}`.slice(0, 255) };
  }
  return {
    failCode: reason.code,
    buyerFault: reason.buyerFault,
    failReason: `${reason.label}${note ? ` · ${note}` : ''}`.slice(0, 255),
  };
};

const labelOf = (code) => BY_CODE.get(code)?.label || null;

module.exports = { FAIL_REASONS, readFail, labelOf };
