const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const AppError = require('../utils/AppError');
const redis = require('../utils/redis');
const hashToken = require('../utils/hashToken');
const { sendMail } = require('../utils/mailer');
const { sendSms, checkSms } = require('../utils/sms');
const crypto = require('crypto');

exports.register = async (req, res, next) => {
    try {
        const email = req.body?.email?.trim() || undefined;
        const { password } = req.body ?? {};

        if (!email) {
            throw new AppError('Email required', 400, [
                { field: 'email', message: 'provide email' }
            ], 'ERR_VALIDATION');
        }

        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            throw new AppError('Email already registered', 409, [
                { field: 'email', message: 'email is already registered' }
            ], 'ERR_EMAIL_TAKEN');
        }

        const user = await User.create({ email, password });
        res.status(201).json({
            message: 'User created successfully. Please login.',
            user: { id: user._id, email: user.email, phone: user.phone, role: user.role }
        });
    } catch (e) {
        next(e);
    }
};

exports.login = async (req, res, next) => {
    try {
        const email = req.body?.email?.trim() || undefined;
        const { password } = req.body ?? {};

        if (!email) {
            throw new AppError('Email required', 400, [], 'ERR_VALIDATION');
        }

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
            user: { id: user._id, email: user.email, phone: user.phone, role: user.role }
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
            const uid = String(decoded.userId);
            const setKey = `user:${uid}:refresh`;
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

        const access = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null;

        if (access) {
            const decoded = jwt.decode(access);
            const ttl = Math.max((decoded?.exp ?? 0) - Math.floor(Date.now() / 1000), 1);
            await redis.set(`access:${hashToken(access)}`, '1', { EX: ttl });
        }

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

exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body ?? {};
        if (!currentPassword || !newPassword) {
            throw new AppError('Current and new password required', 400, [], 'ERR_VALIDATION');
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            throw new AppError('User no longer exists', 401, [], 'ERR_USER_GONE');
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            throw new AppError('Invalid credentials', 401, [], 'ERR_INVALID_CREDENTIALS');
        }

        user.password = newPassword;
        await user.save();

        const userId = String(user._id);
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

        res.status(200).json({ message: 'Password changed. Please login.' });
    } catch (e) {
        next(e);
    }
};

exports.sendVerifyEmail = async (req, res, next) => {
    try {
        if (!req.user.email) {
            throw new AppError('No email on this account', 400, [], 'ERR_VALIDATION');
        }
        if (req.user.emailVerified) {
            return res.status(200).json({ message: 'Email already verified' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        await redis.set(`verify:${hashToken(token)}`, String(req.user._id), {
            EX: 24 * 60 * 60
        });

        const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
        await sendMail({
            to: req.user.email,
            subject: 'Verify your email',
            text: `Verify your email: ${link}`,
            html: `<p><a href="${link}">Verify your email</a></p>`
        });

        res.status(200).json({ message: 'Verification email sent' });
    } catch (e) {
        next(e);
    }
};

exports.verifyEmail = async (req, res, next) => {
    try {
        const token = req.body?.token;
        if (!token) {
            throw new AppError('Token required', 400, [], 'ERR_VALIDATION');
        }

        const key = `verify:${hashToken(token)}`;
        const userId = await redis.get(key);
        if (!userId) {
            throw new AppError('Invalid or expired token', 400, [], 'ERR_INVALID_TOKEN');
        }

        const user = await User.findByIdAndUpdate(userId, { emailVerified: true });
        await redis.del(key);
        if (!user) {
            throw new AppError('User no longer exists', 401, [], 'ERR_USER_GONE');
        }

        res.status(200).json({ message: 'Email verified' });
    } catch (e) {
        next(e);
    }
};

exports.sendVerifyPhone = async (req, res, next) => {
    try {
        if (!req.user.phone) {
            throw new AppError('No phone on this account', 400, [], 'ERR_VALIDATION');
        }
        if (req.user.phoneVerified) {
            return res.status(200).json({ message: 'Phone already verified' });
        }

        await sendSms({ to: req.user.phone });
        res.status(200).json({ message: 'Verification code sent' });
    } catch (e) {
        next(e);
    }
};

exports.verifyPhone = async (req, res, next) => {
    try {
        const otp = String(req.body?.otp ?? '').trim();
        if (!otp) {
            throw new AppError('OTP required', 400, [], 'ERR_VALIDATION');
        }
        if (!req.user.phone) {
            throw new AppError('No phone on this account', 400, [], 'ERR_VALIDATION');
        }

        const ok = await checkSms({ to: req.user.phone, code: otp });
        if (!ok) {
            throw new AppError('Invalid or expired code', 400, [], 'ERR_INVALID_TOKEN');
        }

        await User.findByIdAndUpdate(req.user._id, { phoneVerified: true });
        res.status(200).json({ message: 'Phone verified' });
    } catch (e) {
        next(e);
    }
};
