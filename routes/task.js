const express = require("express");
const router = express.Router();

const { protect } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validateObjectId');
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

/**
 * @openapi
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List your tasks
 *     description: Returns only tasks owned by the authenticated user. Unknown sort fields are ignored rather than rejected, falling back to newest first. Results are paged (`page`, `limit`); defaults are page 1 and 10 items, max 100.
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [not-started, pending, in-progress, completed]
 *       - name: priority
 *         in: query
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *       - name: tag
 *         in: query
 *         description: Matches tasks containing this single tag
 *         schema:
 *           type: string
 *           example: work
 *       - name: search
 *         in: query
 *         description: Case-insensitive match against title and description
 *         schema:
 *           type: string
 *       - name: sort
 *         in: query
 *         description: "Field name, optionally prefixed with `-` for descending. Defaults to `-createdAt`."
 *         schema:
 *           type: string
 *           enum: [createdAt, -createdAt, updatedAt, -updatedAt, dueDate, -dueDate, title, -title, priority, -priority, status, -status]
 *       - name: page
 *         in: query
 *         description: 1-based page number. Defaults to 1.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Page size. Defaults to 10, maximum 100.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: One page of matching tasks, newest first unless sorted otherwise
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 total:
 *                   type: integer
 *                   example: 47
 *                 totalPages:
 *                   type: integer
 *                   example: 5
 *       400:
 *         $ref: '#/components/responses/ValidationFailed'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', getTasks);

/**
 * @openapi
 * /tasks/bulk:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete several tasks by id
 *     description: Ids that don't exist or belong to another user are skipped silently — compare `deletedCount` with the number you sent.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 example: ["6a733d77aae10fd99b9525ed", "6a733d77aae10fd99b9525ee"]
 *     responses:
 *       200:
 *         description: Deletion result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 2 task(s) deleted
 *                 deletedCount:
 *                   type: integer
 *                   example: 2
 *       400:
 *         $ref: '#/components/responses/ValidationFailed'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/bulk', deleteManyTasks);

/**
 * @openapi
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get one task
 *     description: A task belonging to another user returns 404, not 403 — the API never confirms that someone else's id exists.
 *     parameters:
 *       - $ref: '#/components/parameters/TaskId'
 *     responses:
 *       200:
 *         description: The task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         $ref: '#/components/responses/ValidationFailed'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', validateObjectId(), getTaskById);

/**
 * @openapi
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task
 *     description: Ownership comes from the token, so sending `userId` has no effect. Server-owned fields (`_id`, `userId`, `createdAt`, `updatedAt`) are dropped silently, letting you POST back a task you fetched.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskInput'
 *     responses:
 *       201:
 *         description: The created task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         $ref: '#/components/responses/ValidationFailed'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', createTask);

/**
 * @openapi
 * /tasks/{id}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update some fields of a task
 *     description: Send only the fields you're changing. An empty body is a 400. When only one of the two dates is sent, it is checked against the stored value so `startReminder` can never end up after `dueDate`.
 *     parameters:
 *       - $ref: '#/components/parameters/TaskId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/TaskInput'
 *               - type: object
 *                 required: []
 *             example:
 *               status: completed
 *               priority: high
 *     responses:
 *       200:
 *         description: The updated task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         $ref: '#/components/responses/ValidationFailed'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/:id', validateObjectId(), updateTask);

/**
 * @openapi
 * /tasks/{id}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete one task
 *     description: Returns the deleted document so the client can undo or show what was removed.
 *     parameters:
 *       - $ref: '#/components/parameters/TaskId'
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Task deleted
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 *       400:
 *         $ref: '#/components/responses/ValidationFailed'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:id', validateObjectId(), deleteTask);

/**
 * @openapi
 * /tasks/bulk:
 *   post:
 *     tags: [Tasks]
 *     summary: Create up to 10 tasks in one request
 *     description: All-or-nothing on validation — every element is checked and every problem reported at once, labelled `tasks[index].field`, so one round trip is enough to fix the batch.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tasks]
 *             properties:
 *               tasks:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 10
 *                 items:
 *                   $ref: '#/components/schemas/TaskInput'
 *     responses:
 *       201:
 *         description: The created tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Tasks created successfully
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *       400:
 *         description: Too many tasks, or one or more failed validation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: 400
 *               message: Validation failed
 *               errors:
 *                 - field: tasks[0].title
 *                   message: tasks[0].title must be a string between 3 and 100 characters
 *                 - field: tasks[2].description
 *                   message: tasks[2].description is required
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/bulk', createTasksInBulk);

module.exports = router;
