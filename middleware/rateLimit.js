const rateLimit = require('express-rate-limit');

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

const jsonLimitHandler = (req, res) => {
    res.status(429).json({
        message: 'Too many requests, please try again later',
    });
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
