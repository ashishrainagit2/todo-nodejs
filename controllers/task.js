const Task = require('../models/task');

exports.getTasks = async (req, res, next) => {
    try {
        const filter = { userId: req.user._id };

        if (req.query.status) filter.status = req.query.status;
        if (req.query.priority) filter.priority = req.query.priority;
        if (req.query.tag) filter.tags = req.query.tag;

        if (req.query.search) {
            filter.$or = [
                { title: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const allowedSortFields = ['createdAt', 'updatedAt', 'dueDate', 'title', 'priority', 'status'];
        let sort = '-createdAt';

        if (req.query.sort) {
            const field = req.query.sort.startsWith('-')
                ? req.query.sort.slice(1)
                : req.query.sort;

            if (allowedSortFields.includes(field)) {
                sort = req.query.sort;
            }
        }

        const tasks = await Task.find(filter).sort(sort);
        res.json(tasks);
    } catch (e) {
        next(e);
    }
};

exports.getTaskById = async (req, res, next) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.json(task);
    } catch (e) {
        next(e);
    }
};

exports.createTask = async (req, res, next) => {
    try {
        const task = new Task({
            title: req.body.title,
            description: req.body.description,
            status: req.body.status,
            dueDate: req.body.dueDate,
            priority: req.body.priority,
            startReminder: req.body.startReminder,
            tags: req.body.tags,
            attachments: req.body.attachments,
            comments: req.body.comments,
            subTasks: req.body.subTasks,
            parentTask: req.body.parentTask,
            userId: req.user._id
        });

        const saved = await task.save();
        res.status(201).json(saved);
    } catch (e) {
        next(e);
    }
};

exports.updateTask = async (req, res, next) => {
    try {
        const { userId, ...updates } = req.body;

        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            updates,
            { new: true }
        );
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.json(task);
    } catch (e) {
        next(e);
    }
};

exports.deleteManyTasks = async (req, res, next) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Send an array of ids in the body' });
        }

        const result = await Task.deleteMany({ _id: { $in: ids }, userId: req.user._id });
        res.json({
            message: `${result.deletedCount} task(s) deleted`,
            deletedCount: result.deletedCount
        });
    } catch (e) {
        next(e);
    }
};

exports.deleteTask = async (req, res, next) => {
    try {
        const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.json({ message: 'Task deleted', task });
    } catch (e) {
        next(e);
    }
};

exports.createTasksInBulk = async (req, res, next) => {
    try {
        const tasksFromBody = req.body.tasks;

        if (!Array.isArray(tasksFromBody) || tasksFromBody.length === 0) {
            return res.status(400).json({ message: 'Send an array of tasks in body.tasks' });
        }

        const tasksWithUser = tasksFromBody.map((task) => ({
            ...task,
            userId: req.user._id
        }));

        const savedTasks = await Task.insertMany(tasksWithUser);

        res.status(201).json({
            message: 'Tasks created successfully',
            tasks: savedTasks
        });
    } catch (e) {
        next(e);
    }
};