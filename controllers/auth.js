const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');

exports.register = async (req, res, next) => {
    try {
        const { email, password, role } = req.body;
        const user = await User.create({ email, password, role });
        res.status(201).json({
            message: 'User created successfully. Please login.',
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (e) {
        if (e.code === 11000) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        next(e);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
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
