const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

// reject malformed ids before they reach MongoDB, in the same shape as body validation
exports.validateObjectId = (param = 'id') => (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[param])) {
        return next(new AppError('Validation failed', 400, [
            { field: param, message: `${param} must be a valid task id` }
        ]));
    }
    next();
};
