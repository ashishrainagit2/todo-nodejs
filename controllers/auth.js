const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const AppError = require('../utils/AppError');

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
        console.log('ASHISHRAINA999 @1 error in register controller ', e);
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

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (e) {
        next(e);
    }
};
