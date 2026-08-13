const express = require("express");
const router = express.Router();

const { register, login } = require('../controllers/auth');

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create an account
 *     description: Public. The password is hashed by a pre-save hook before it reaches MongoDB. No token is issued — log in separately.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Account created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User created successfully. Please login.
 *                 user:
 *                   $ref: '#/components/schemas/AuthUser'
 *       400:
 *         $ref: '#/components/responses/ValidationFailed'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: 409
 *               message: Email already registered
 *               errors:
 *                 - field: email
 *                   message: email is already registered
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/register', register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange credentials for a JWT
 *     description: "Public. Returns the token to send as `Authorization: Bearer <token>` on every task endpoint."
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   $ref: '#/components/schemas/AuthUser'
 *       401:
 *         description: Unknown email or wrong password — deliberately the same message for both, so the response never reveals which
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: 401
 *               message: Invalid credentials
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/login', login);

module.exports = router;
