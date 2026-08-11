const Task = require('../models/task');
const AppError = require('../utils/AppError');

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
            throw new AppError('Task not found', 404);
        }
        res.json(task);
    } catch (e) {
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

// field is the error label — bulk passes "tasks[0].status" so the client knows which task failed
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

const readStringArray = (value, field, rules, errors) => {
    if (isBlank(value)) return undefined;

    const { maxItems, maxLength, unique } = rules;

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
        errors.push({ field, message: `${field} must be a string between ${min} and ${max} characters` });
        return undefined;
    }
    return text;
};

// one rule per field, shared by create, update and bulk create
const TASK_FIELD_READERS = {
    title: (value, field, errors) => readText(value, field, 3, 100, errors),
    description: (value, field, errors) => readText(value, field, 3, 1000, errors),
    status: (value, field, errors) => readEnum(value, field, TASK_STATUSES, errors),
    priority: (value, field, errors) => readEnum(value, field, TASK_PRIORITIES, errors),
    dueDate: (value, field, errors) => readDate(value, field, errors),
    startReminder: (value, field, errors) => readDate(value, field, errors),
    tags: (value, field, errors) => readStringArray(value, field, ARRAY_FIELD_RULES.tags, errors),
    attachments: (value, field, errors) => readStringArray(value, field, ARRAY_FIELD_RULES.attachments, errors),
    comments: (value, field, errors) => readStringArray(value, field, ARRAY_FIELD_RULES.comments, errors),
    subTasks: (value, field, errors) => readStringArray(value, field, ARRAY_FIELD_RULES.subTasks, errors),
    parentTask: (value, field, errors) => readText(value, field, 1, 100, errors)
};

const REQUIRED_TASK_FIELDS = ['title', 'description'];

// server-owned — dropped without complaint so a client can POST back a task it fetched
const SERVER_OWNED_FIELDS = ['_id', 'id', 'userId', 'createdAt', 'updatedAt', '__v'];

const DATE_ORDER_MESSAGE = 'startReminder must be before dueDate';

// partial: PATCH sends only changed fields, so missing ones are not errors
// prefix: bulk labels errors as "tasks[2].title"
// omitted fields stay out of the document so the schema defaults apply
const validateTaskBody = (body, { partial = false, prefix = '' } = {}) => {
    const errors = [];
    // a non-JSON request leaves req.body undefined — report it as a 400, not a crash
    const source = body !== null && typeof body === 'object' ? body : {};
    const label = (field) => `${prefix}${field}`;

    // catch client typos like "prioriy" instead of letting Mongoose drop them silently
    for (const key of Object.keys(source)) {
        if (!(key in TASK_FIELD_READERS) && !SERVER_OWNED_FIELDS.includes(key)) {
            errors.push({ field: label(key), message: `${label(key)} is not an allowed field` });
        }
    }

    const value = {};

    for (const [field, read] of Object.entries(TASK_FIELD_READERS)) {
        if (!Object.hasOwn(source, field)) {
            if (!partial && REQUIRED_TASK_FIELDS.includes(field)) {
                errors.push({ field: label(field), message: `${label(field)} is required` });
            }
            continue;
        }

        const parsed = read(source[field], label(field), errors);
        if (parsed !== undefined) value[field] = parsed;
    }

    if (value.dueDate && value.startReminder && value.startReminder > value.dueDate) {
        errors.push({ field: label('startReminder'), message: DATE_ORDER_MESSAGE });
    }

    return { errors, value };
};

const validationError = (errors) => new AppError('Validation failed', 400, errors);

exports.createTask = async (req, res, next) => {
    const { errors, value } = validateTaskBody(req.body);

    if (errors.length > 0) {
        return next(validationError(errors));
    }

    try {
        const task = new Task({ ...value, userId: req.user._id });

        const saved = await task.save();
        res.status(201).json(saved);
    } catch (e) {
        next(e);
    }
};

exports.updateTask = async (req, res, next) => {
    const { errors, value: updates } = validateTaskBody(req.body, { partial: true });

    if (errors.length > 0) {
        return next(validationError(errors));
    }

    if (Object.keys(updates).length === 0) {
        return next(new AppError('No valid fields to update', 400));
    }

    try {
        // only one of the two dates sent? compare it against the one already stored
        const sentDueDate = Object.hasOwn(updates, 'dueDate');
        const sentStartReminder = Object.hasOwn(updates, 'startReminder');

        if (sentDueDate !== sentStartReminder) {
            const stored = await Task.findOne({ _id: req.params.id, userId: req.user._id })
                .select('dueDate startReminder');

            if (!stored) {
                throw new AppError('Task not found', 404);
            }

            const dueDate = updates.dueDate ?? stored.dueDate;
            const startReminder = updates.startReminder ?? stored.startReminder;

            if (dueDate && startReminder && startReminder > dueDate) {
                throw validationError([
                    { field: 'startReminder', message: DATE_ORDER_MESSAGE }
                ]);
            }
        }

        // updatedAt bumped by schema { timestamps: true }; _id / userId / createdAt ignored
        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            updates,
            { new: true, runValidators: true }
        );
        if (!task) {
            throw new AppError('Task not found', 404);
        }
        res.json(task);
    } catch (e) {
        next(e);
    }
};

exports.deleteManyTasks = async (req, res, next) => {
    try {
        const ids = req.body?.ids;

        if (!Array.isArray(ids) || ids.length === 0) {
            throw new AppError('Send an array of ids in the body', 400, [
                { field: 'ids', message: 'ids must be a non-empty array' }
            ]);
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
            throw new AppError('Task not found', 404);
        }
        res.json({ message: 'Task deleted', task });
    } catch (e) {
        next(e);
    }
};

const BULK_CREATE_LIMIT = 10;

exports.createTasksInBulk = async (req, res, next) => {
    try {
        const tasksFromBody = req.body?.tasks;

        if (!Array.isArray(tasksFromBody) || tasksFromBody.length === 0) {
            throw new AppError('Send an array of tasks in body.tasks', 400, [
                { field: 'tasks', message: 'tasks must be a non-empty array' }
            ]);
        }

        if (tasksFromBody.length > BULK_CREATE_LIMIT) {
            throw new AppError(
                `Send at most ${BULK_CREATE_LIMIT} tasks per request (received ${tasksFromBody.length})`,
                400,
                [{ field: 'tasks', message: `tasks allows at most ${BULK_CREATE_LIMIT} items` }]
            );
        }

        // every element is checked, so the client fixes the whole batch in one round trip
        const errors = [];
        const tasksWithUser = [];

        tasksFromBody.forEach((task, index) => {
            if (task === null || typeof task !== 'object' || Array.isArray(task)) {
                errors.push({ field: `tasks[${index}]`, message: `tasks[${index}] must be an object` });
                return;
            }

            const { errors: taskErrors, value } = validateTaskBody(task, { prefix: `tasks[${index}].` });

            errors.push(...taskErrors);
            tasksWithUser.push({ ...value, userId: req.user._id });
        });

        if (errors.length > 0) {
            throw validationError(errors);
        }

        const savedTasks = await Task.insertMany(tasksWithUser);

        res.status(201).json({
            message: 'Tasks created successfully',
            tasks: savedTasks
        });
    } catch (e) {
        next(e);
    }
};