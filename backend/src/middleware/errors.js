class ApiError extends Error {
  /**
   * @param {String} message - Shown to the person
   * @param {Number} status - HTTP status
   * @param {Object} [errors] - Per-field messages: { field: message }
   */
  constructor(message, status = 400, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message, errors: err.errors });
  }
  if (err?.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'That photo is too big (5 MB at most).' : 'That upload did not work.';
    return res.status(400).json({ success: false, message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Unreadable request' });
  }
  console.error(err);
  return res.status(500).json({ success: false, message: 'Something went wrong on our side.' });
};

module.exports = { ApiError, notFound, errorHandler };
