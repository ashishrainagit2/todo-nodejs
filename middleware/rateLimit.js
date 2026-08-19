const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

// hand off to the global handler so 429s use the same shape as every other error
const jsonLimitHandler = (req, res, next) => {
    next(new AppError('Too many requests, please try again later', 429, [], 'ERR_RATE_LIMIT'));
};

// General API — per IP, all /tasks routes
exports.apiLimiter = rateLimit({
    windowMs,
    max: Number(process.env.RATE_LIMIT_MAX) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonLimitHandler,
});

// Auth — stricter to slow brute-force login/register attempts
exports.authLimiter = rateLimit({
    windowMs,
    max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonLimitHandler,
});
