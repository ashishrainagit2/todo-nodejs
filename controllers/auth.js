const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const AppError = require('../utils/AppError');
const redis = require('../utils/redis');
const crypto = require('crypto');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

exports.register = async (req, res, next) => {
    try {
        const { email, password, role } = req.body ?? {};

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new AppError('Email already registered', 409, [
                { field: 'email', message: 'email is already registered' }
            ], 'ERR_EMAIL_TAKEN');
        }

        const user = await User.create({ email, password, role });
        res.status(201).json({
            message: 'User created successfully. Please login.',
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (e) {
        next(e);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body ?? {};
        const user = await User.findOne({ email });
        if (!user) {
            // same message for unknown email and wrong password — don't reveal which
            throw new AppError('Invalid credentials', 401, [], 'ERR_INVALID_CREDENTIALS');
        }

        const isMatch = await bcrypt.compare(password ?? '', user.password);
        if (!isMatch) {
            throw new AppError('Invalid credentials', 401, [], 'ERR_INVALID_CREDENTIALS');
        }

        const access_token = jwt.sign(
            { userId: user._id, type: 'access'},
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m' }
        );

        const refresh_token = jwt.sign(
            { userId: user._id, type: 'refresh' },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d' }
        );

        const hash = hashToken(refresh_token);
        const userId = String(user._id);

        await redis.set(`refresh:${hash}`, userId, {
            EX: 7 * 24 * 60 * 60
        });
        await redis.sAdd(`user:${userId}:refresh`, hash);

        res.cookie('refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });
        res.status(200).json({
            message: 'Login successful',
            access_token,
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (e) {
        next(e);
    }
};

exports.refresh = async (req, res, next) => {
    try {
        const refresh_token = req.cookies?.refresh_token || req.body?.refresh_token;
        if (!refresh_token) {
            throw new AppError('Refresh token required', 401, [], 'ERR_NO_TOKEN');
        }

        let decoded;
        try {
            decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
        } catch (e) {
            throw new AppError('Not authorized, invalid token', 401, [], 'ERR_INVALID_TOKEN');
        }

        if (decoded.type !== 'refresh') {
            throw new AppError('Not authorized, invalid token', 401, [], 'ERR_INVALID_TOKEN');
        }

        const userId = await redis.get(`refresh:${hashToken(refresh_token)}`);
        if (!userId) {
            throw new AppError('Not authorized, invalid token', 401, [], 'ERR_INVALID_TOKEN');
        }

        const access_token = jwt.sign(
            { userId: decoded.userId, type: 'access' },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m' }
        );

        const new_refresh_token = jwt.sign(
            { userId: decoded.userId, type: 'refresh' },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d' }
        );

        const oldHash = hashToken(refresh_token);
        const newHash = hashToken(new_refresh_token);
        const uid = String(decoded.userId);

        await redis.del(`refresh:${oldHash}`);
        await redis.sRem(`user:${uid}:refresh`, oldHash);

        await redis.set(`refresh:${newHash}`, uid, {
            EX: 7 * 24 * 60 * 60
        });
        await redis.sAdd(`user:${uid}:refresh`, newHash);

        res.cookie('refresh_token', new_refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        });


        res.status(200).json({
            access_token
        });

    } catch (e) {
        next(e);
    }
};

exports.logout = async (req, res, next) => {
    try {
        const refresh_token = req.cookies?.refresh_token || req.body?.refresh_token;
        if (!refresh_token) {
            throw new AppError('Refresh token required', 401, [], 'ERR_NO_TOKEN');
        }

        const hash = hashToken(refresh_token);
        const uid = await redis.get(`refresh:${hash}`);
        await redis.del(`refresh:${hash}`);
        if (uid) await redis.sRem(`user:${uid}:refresh`, hash);

        res.clearCookie('refresh_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });

        res.status(200).json({ message: 'Logged out' });
        // client needs to drop access token
    } catch (e) {
        next(e);
    }
};

exports.logoutAll = async (req, res, next) => {
    try {
        const userId = String(req.user._id);
        const setKey = `user:${userId}:refresh`;
        const hashes = await redis.sMembers(setKey);

        if (hashes.length) {
            await redis.del(hashes.map((h) => `refresh:${h}`));
        }
        await redis.del(setKey);

        res.clearCookie('refresh_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });

        res.status(200).json({ message: 'Logged out from all devices' });
    } catch (e) {
        next(e);
    }
};
