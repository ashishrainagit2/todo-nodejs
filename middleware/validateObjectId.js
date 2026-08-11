const mongoose = require('mongoose');

// reject malformed ids before they reach MongoDB, in the same shape as body validation
exports.validateObjectId = (param = 'id') => (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[param])) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: [{ field: param, message: `${param} must be a valid task id` }]
        });
    }
    next();
};
