/**
 * Small input checks: collect a message per field, then fail once with all
 * of them, so a form can show every problem at the same time.
 */
const { ApiError } = require('../middleware/errors');

const text = (value, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const PH_MOBILE = /^(09|\+639)\d{9}$/;
const phone = (value) => text(value, 20).replace(/[\s-]/g, '');
const isPhone = (value) => PH_MOBILE.test(value);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const failIf = (errors) => {
  if (Object.keys(errors).length) {
    throw new ApiError(Object.values(errors)[0], 422, errors);
  }
};

module.exports = { text, phone, isPhone, isEmail, failIf };
