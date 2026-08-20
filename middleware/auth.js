const jwt = require('jsonwebtoken');
const User = require('../models/user');
const AppError = require('../utils/AppError');
const { setContext } = require('../utils/requestContext');

exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('Not authorized, no token', 401, [], 'ERR_NO_TOKEN'));
    }

    let decoded;
    try {
        // verifies the token by checking the secret key and the token against the secret key in the environment variables
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        // { userId: '6a7b242f3b7877edcc1769e4', iat: 1786455087, exp: 1787059887 }
    } catch (e) {
        // expired or tampered token — never a server bug
        // userId stays null on the ALS store — we never learned who they are
        return next(new AppError('Not authorized, invalid token', 401, [], 'ERR_INVALID_TOKEN'));
    }

    // JWT payload is enough to stamp the user on this request's async context
    // (even if the DB row is gone a moment later).
    setContext({ userId: String(decoded.userId) });

    try {
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            throw new AppError('User no longer exists', 401, [], 'ERR_USER_GONE');
        }

        req.user = user;
        next();
    } catch (e) {
        // a DB failure here is a real error, so let the global handler decide
        next(e);
    }
};
