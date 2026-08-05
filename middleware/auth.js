const jwt = require('jsonwebtoken');
const User = require('../models/user');

exports.protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no token' });
        }
        // verifies the token by checking the secret key and the token against the secret key in the environment variables
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('decoded token: ', decoded);
        const user = await User.findById(decoded.userId).select('-password');

        // Summary: Line 17 = trust the token. Line 18 = confirm the user still exists in MongoDB. Both must pass before req.user is set.

        // Summary: You can authenticate with just the token — many apps do for speed. Your middleware also checks the DB so deleted/invalid users can't keep using old tokens. That's the safer choice for learning and for real apps.

        if (!user) {
            return res.status(401).json({ message: 'User no longer exists' });
        }

        req.user = user;
        next();
    } catch (e) {
        return res.status(401).json({ message: 'Not authorized, invalid token' });
    }
};
