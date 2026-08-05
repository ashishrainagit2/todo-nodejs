const express = require("express");
const router = express.Router();

const { protect } = require('../middleware/auth');
const {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteManyTasks,
    deleteTask,
    createTasksInBulk
} = require('../controllers/task');

// All task routes require a valid JWT
router.use(protect);

// GET /tasks → all tasks (optional: ?status=pending&sort=-dueDate&tag=work)
router.get('/', getTasks);

// DELETE /tasks/bulk → delete many (must be before /:id)
router.delete('/bulk', deleteManyTasks);

// GET /tasks/:id → one task
router.get('/:id', getTaskById);

// POST /tasks → create task
router.post('/', createTask);

// PATCH /tasks/:id → update task
router.patch('/:id', updateTask);

// DELETE /tasks/:id → delete one task
router.delete('/:id', deleteTask);

// add multiple tasks
router.post('/bulk', createTasksInBulk);

module.exports = router;
