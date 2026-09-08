const jwt = require('jsonwebtoken');
const User = require('../models/user');
const AppError = require('../utils/AppError');
const redis = require('../utils/redis');
const hashToken = require('../utils/hashToken');
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
        decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        // { userId: '6a7b242f3b7877edcc1769e4', iat: 1786455087, exp: 1787059887 }
    } catch (e) {
        // expired or tampered token — never a server bug
        // userId stays null on the ALS store — we never learned who they are
        return next(new AppError('Not authorized, invalid token', 401, [], 'ERR_INVALID_TOKEN'));
    }

    if (decoded.type !== 'access') {
        return next(new AppError('Not authorized, invalid token', 401, [], 'ERR_INVALID_TOKEN'));
    }

    try {
        const blocked = await redis.get(`access:${hashToken(token)}`);
        if (blocked) {
            throw new AppError('Not authorized, invalid token', 401, [], 'ERR_INVALID_TOKEN');
        }

        setContext({ userId: String(decoded.userId) });

        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            throw new AppError('User no longer exists', 401, [], 'ERR_USER_GONE');
        }

        req.user = user;
        next();
    } catch (e) {
        next(e);
    }
};
