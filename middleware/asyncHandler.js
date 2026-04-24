/**
 * Async handler wrapper — catches rejected promises and forwards to Express error middleware.
 */
const asyncHandler = (fn) => {
  return function asyncHandlerWrapper(req, res, next) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
