// Express 4 pattern: wrap an async route so a rejected await becomes next(err).
// Express 5 already does this for async handlers — this file is unused on purpose.
//
// How you would use it (example only — not wired up):
//
//   const asyncHandler = require('../utils/asyncHandler');
//   const { getTasks } = require('../controllers/task');
//
//   // before (Express 4): forget try/catch → hang / crash
//   router.get('/tasks', protect, getTasks);
//
//   // after: wrapper catches a rejected await and calls next(err)
//   router.get('/tasks', protect, asyncHandler(getTasks));
//
//   // getTasks can then drop try/catch + next(e):
//   //   exports.getTasks = async (req, res) => {
//   //       const tasks = await Task.find({ userId: req.user._id });
//   //       res.json({ data: tasks });
//   //   };
//
module.exports = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
