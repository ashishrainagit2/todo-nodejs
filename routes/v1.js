const express = require('express');
const router = express.Router();

const { apiLimiter, authLimiter } = require('../middleware/rateLimit');
const TaskRoutes = require('./task');
const AuthRoutes = require('./auth');

// Everything the v1 contract covers. A future v2 gets its own file, so both
// versions can run side by side while clients migrate.
router.use('/tasks', apiLimiter, TaskRoutes);
router.use('/auth', authLimiter, AuthRoutes);

module.exports = router;
