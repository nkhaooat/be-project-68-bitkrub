/**
 * Global error handler middleware for Express.
 * Catches errors thrown by asyncHandler-wrapped controllers and sends
 * a consistent JSON response.
 */
function errorHandler(err, req, res, next) {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}: ${err.value}` });
  }

  // Duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue).join(', ');
    return res.status(400).json({ success: false, message: `Duplicate value for ${field}` });
  }

  // Default: use the error's message or generic fallback
  const statusCode = err.statusCode || 400;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server Error',
  });
}

module.exports = errorHandler;
