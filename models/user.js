const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = mongoose.Schema({
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'email must be a valid email address']
    },
    phone: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        match: [/^\+?[0-9]{10,15}$/, 'phone must be 10–15 digits']
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'user', 'manager'],
        default: 'user'
    }
});

UserSchema.pre('validate', function () {
    if (!this.email && !this.phone) {
        this.invalidate('email', 'email or phone is required');
    }
});

UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', UserSchema);
