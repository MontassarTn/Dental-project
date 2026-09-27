/** Lets Express 4 route handlers be async: rejected promises go to the error handler. */
module.exports = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
