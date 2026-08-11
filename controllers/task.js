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
        console.error('Error getting task by id: ', e);
        console.log('Error status getting task by id: ', e.status);
        next(e);
    }
};

const TASK_STATUSES = ['not-started', 'pending', 'in-progress', 'completed'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];

// max items per array, max characters per item, whether duplicates are dropped
const ARRAY_FIELD_RULES = {
    tags: { maxItems: 20, maxLength: 30, unique: true },
    attachments: { maxItems: 10, maxLength: 300, unique: true },
    comments: { maxItems: 50, maxLength: 500, unique: false },
    subTasks: { maxItems: 50, maxLength: 200, unique: false }
};

const isBlank = (value) => value === undefined || value === null || value === '';

// "In Progress" and "not started" both become valid enum values
const normalizeEnumValue = (value) => value.trim().toLowerCase().replace(/\s+/g, '-');

const readEnum = (value, field, allowed, errors) => {
    if (isBlank(value)) return undefined;
    if (typeof value !== 'string') {
        errors.push({ field, message: `${field} must be a string` });
        return undefined;
    }

    const normalized = normalizeEnumValue(value);
    if (!allowed.includes(normalized)) {
        errors.push({ field, message: `${field} must be one of: ${allowed.join(', ')}` });
        return undefined;
    }
    return normalized;
};

// midnight today, so a date-only value like "2026-08-11" still counts as today
const startOfToday = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

const readDate = (value, field, errors) => {
    if (isBlank(value)) return undefined;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        errors.push({ field, message: `${field} must be a valid date` });
        return undefined;
    }
    if (date < startOfToday()) {
        errors.push({ field, message: `${field} cannot be in the past` });
        return undefined;
    }
    return date;
};

const readStringArray = (value, field, errors) => {
    if (isBlank(value)) return undefined;

    const { maxItems, maxLength, unique } = ARRAY_FIELD_RULES[field];

    if (!Array.isArray(value)) {
        errors.push({ field, message: `${field} must be an array` });
        return undefined;
    }
    if (value.some((item) => typeof item !== 'string')) {
        errors.push({ field, message: `${field} must contain strings only` });
        return undefined;
    }

    let cleaned = value.map((item) => item.trim()).filter((item) => item.length > 0);
    if (unique) cleaned = [...new Set(cleaned)];

    if (cleaned.length > maxItems) {
        errors.push({ field, message: `${field} allows at most ${maxItems} items` });
        return undefined;
    }
    if (cleaned.some((item) => item.length > maxLength)) {
        errors.push({ field, message: `each ${field} item must be ${maxLength} characters or fewer` });
        return undefined;
    }
    return cleaned;
};

const readText = (value, field, min, max, errors) => {
    // type check first, then measure the trimmed value — "  ab  " is 2 chars, not 6
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length < min || text.length > max) {
        errors.push({ field, message: `${field} is required and must be a string between ${min} and ${max} characters` });
        return undefined;
    }
    return text;
};

const CREATE_TASK_FIELDS = [
    'title',
    'description',
    'status',
    'priority',
    'dueDate',
    'startReminder',
    'tags',
    'attachments',
    'comments',
    'subTasks',
    'parentTask'
];

// server-owned — dropped without complaint so a client can POST back a task it fetched
const SERVER_OWNED_FIELDS = ['_id', 'id', 'userId', 'createdAt', 'updatedAt', '__v'];

// omitted fields stay out of the document so the schema defaults apply
const validateCreateTask = (body) => {
    const errors = [];

    // catch client typos like "prioriy" instead of letting Mongoose drop them silently
    for (const key of Object.keys(body)) {
        if (!CREATE_TASK_FIELDS.includes(key) && !SERVER_OWNED_FIELDS.includes(key)) {
            errors.push({ field: key, message: `${key} is not an allowed field` });
        }
    }

    const fields = {
        title: readText(body.title, 'title', 3, 100, errors),
        description: readText(body.description, 'description', 3, 1000, errors),
        status: readEnum(body.status, 'status', TASK_STATUSES, errors),
        priority: readEnum(body.priority, 'priority', TASK_PRIORITIES, errors),
        dueDate: readDate(body.dueDate, 'dueDate', errors),
        startReminder: readDate(body.startReminder, 'startReminder', errors),
        tags: readStringArray(body.tags, 'tags', errors),
        attachments: readStringArray(body.attachments, 'attachments', errors),
        comments: readStringArray(body.comments, 'comments', errors),
        subTasks: readStringArray(body.subTasks, 'subTasks', errors),
        parentTask: isBlank(body.parentTask)
            ? undefined
            : readText(body.parentTask, 'parentTask', 1, 100, errors)
    };

    if (fields.dueDate && fields.startReminder && fields.startReminder > fields.dueDate) {
        errors.push({ field: 'startReminder', message: 'startReminder must be before dueDate' });
    }

    const value = {};
    for (const [key, fieldValue] of Object.entries(fields)) {
        if (fieldValue !== undefined) value[key] = fieldValue;
    }

    return { errors, value };
};

exports.createTask = async (req, res, next) => {
    const { errors, value } = validateCreateTask(req.body);

    if (errors.length > 0) {
        return res.status(400).json({ message: 'Validation failed', errors });
    }

    try {
        const task = new Task({ ...value, userId: req.user._id });

        const saved = await task.save();
        res.status(201).json(saved);
    } catch (e) {
        next(e);
    }
};

const ALLOWED_TASK_UPDATES = [
    'title',
    'description',
    'status',
    'dueDate',
    'priority',
    'startReminder',
    'tags',
    'attachments',
    'comments',
    'subTasks',
    'parentTask'
];

exports.updateTask = async (req, res, next) => {
    try {
        const updates = {};
        for (const key of ALLOWED_TASK_UPDATES) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        // updatedAt bumped by schema { timestamps: true }; _id / userId / createdAt ignored
        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            updates,
            { new: true, runValidators: true }
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

const BULK_CREATE_LIMIT = 10;

exports.createTasksInBulk = async (req, res, next) => {
    try {
        const tasksFromBody = req.body.tasks;

        if (!Array.isArray(tasksFromBody) || tasksFromBody.length === 0) {
            return res.status(400).json({ message: 'Send an array of tasks in body.tasks' });
        }

        if (tasksFromBody.length > BULK_CREATE_LIMIT) {
            return res.status(400).json({
                message: `Send at most ${BULK_CREATE_LIMIT} tasks per request (received ${tasksFromBody.length})`
            });
        }

        const tasksWithUser = tasksFromBody.map((task) => {
            const {
                _id,
                userId,
                createdAt,
                updatedAt,
                __v,
                ...fields
            } = task;
            return { ...fields, userId: req.user._id };
        });

        const savedTasks = await Task.insertMany(tasksWithUser);

        res.status(201).json({
            message: 'Tasks created successfully',
            tasks: savedTasks
        });
    } catch (e) {
        next(e);
    }
};