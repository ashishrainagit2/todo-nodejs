const express = require("express");
const router = express.Router();

const { protect } = require('../middleware/auth');
const { register, login, refresh, logout, logoutAll, changePassword, sendVerifyEmail, verifyEmail, sendVerifyPhone, verifyPhone } = require('../controllers/auth');

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

router.post('/refresh', refresh);

router.post('/logout', logout);

router.post('/logout-all', protect, logoutAll);

router.post('/change-password', protect, changePassword);

/**
 * @openapi
 * /auth/verify-email/send:
 *   post:
 *     tags: [Auth]
 *     summary: Send a verification email
 *     description: Logged in. Empty body. Emails a link to req.user.email. Login does not require a verified email — users can onboard first and verify later.
 *     responses:
 *       200:
 *         description: Mail sent, or already verified
 *       400:
 *         description: No email on this account
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/verify-email/send', protect, sendVerifyEmail);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm email from the link token
 *     description: Public. Frontend reads token from the URL and POSTs it here. No Bearer token.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyEmailRequest'
 *     responses:
 *       200:
 *         description: Email marked verified
 *       400:
 *         description: Missing, invalid, or expired token
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/verify-email', verifyEmail);

/**
 * @openapi
 * /auth/verify-phone/send:
 *   post:
 *     tags: [Auth]
 *     summary: Send a phone verification OTP
 *     description: Logged in. Empty body. SMS goes to the phone saved at register. Login does not require a verified phone.
 *     responses:
 *       200:
 *         description: SMS sent, or already verified
 *       400:
 *         description: No phone on this account
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       502:
 *         description: Twilio send failed
 *       503:
 *         description: Twilio env not set
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/verify-phone/send', protect, sendVerifyPhone);

/**
 * @openapi
 * /auth/verify-phone:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm phone with the OTP
 *     description: Logged in. Body is the code from the SMS. Twilio checks it.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyPhoneRequest'
 *     responses:
 *       200:
 *         description: Phone marked verified
 *       400:
 *         description: Missing, invalid, or expired code
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/verify-phone', protect, verifyPhone);

module.exports = router;
