const jwt = require('jsonwebtoken');
const User = require('../models/user');
const AppError = require('../utils/AppError');

exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('Not authorized, no token', 401));
    }

    let decoded;
    try {
        // verifies the token by checking the secret key and the token against the secret key in the environment variables
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        // expired or tampered token — never a server bug
        return next(new AppError('Not authorized, invalid token', 401));
    }

    try {
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            throw new AppError('User no longer exists', 401);
        }

        req.user = user;
        next();
    } catch (e) {
        // a DB failure here is a real error, so let the global handler decide
        next(e);
    }
};
