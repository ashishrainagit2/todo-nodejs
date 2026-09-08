# Authentication — steps we built

One line each, in the order we added them.

1. User model: email + password.
2. Hash password with bcrypt in a `pre('save')` hook — never store plaintext.
3. Register creates the user only — no tokens, then they login.
4. Login checks password with `bcrypt.compare`.
5. Same error for unknown email and wrong password (`ERR_INVALID_CREDENTIALS`) so we don’t leak which failed.
6. First JWT: one long-lived token in the JSON body.
7. `protect` reads `Authorization: Bearer`, `jwt.verify`, loads `req.user`.
8. Split into two JWTs: **access** (~15m) and **refresh** (7d), different secrets (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`).
9. Payload includes `type: 'access' | 'refresh'` so one cannot be used as the other.
10. Access token stays in the JSON response; client sends it on every protected request.
11. Refresh token is **not** in the JSON.
12. Server sets refresh as an **httpOnly** cookie (`refresh_token`) — JS cannot read it.
13. Cookie flags: `httpOnly`, `sameSite: 'lax'`, `secure` only in production, `path: '/'`.
14. `cookie-parser` middleware so `req.cookies.refresh_token` works.
15. Hash tokens with SHA-256 before Redis (`utils/hashToken.js`) — Redis never stores the raw JWT.
16. On login: `SET refresh:<hash> → userId` with 7-day TTL.
17. On login: `SADD user:<userId>:refresh` so we know every device/session for that user.
18. `POST /auth/refresh` reads the cookie, verifies the refresh JWT, checks Redis.
19. Refresh **rotation**: delete old Redis key, issue new access JWT + new refresh cookie.
20. **Reuse detection**: JWT still verifies but Redis miss → stolen/old token → wipe **all** refresh sessions for that user + `clearCookie`.
21. `POST /auth/logout` (this device): `DEL` that refresh hash, `SREM` from the user’s set, `clearCookie`.
22. **Instant logout** for the current access token: if `Authorization: Bearer` is sent on logout, denylist `access:<hash>` in Redis with TTL until `exp`.
23. `protect` checks the access denylist — blocked token is 401 even if the JWT is still unexpired.
24. `POST /auth/logout-all` (logged in): delete every `refresh:<hash>` in that user’s set, then delete the set, `clearCookie`.
25. Leftover access tokens on other devices still work until 15m unless they also get denylisted (we skipped `tokenVersion` for instant all-device access kill).
26. `POST /auth/change-password`: current + new, bcrypt via pre-save, wipe all refresh sessions, `clearCookie`.
27. Role is **not** accepted from the API; schema default is `user` (nobody can register as admin).
28. Register requires **email and phone**; login is **email or phone** + password.
29. Sparse unique on email and phone so either field can exist without colliding on `null`.
30. `emailVerified` / `phoneVerified` flags, default `false` — login does **not** block unverified users.
31. Email verify send (logged in): random token, store `verify:<hash> → userId` in Redis 24h, email a frontend link.
32. Email verify confirm (public): POST `{ token }`, hash, Redis lookup, set `emailVerified`, delete key.
33. Nodemailer + Gmail SMTP env (`SMTP_*`, `MAIL_FROM`, `FRONTEND_URL`).
34. Phone verify send (logged in): empty body, SMS to the phone saved at register (Twilio Verify holds the OTP today).
35. Phone verify confirm (logged in): POST `{ otp }`, provider checks it, set `phoneVerified`.

Not done yet:

36. Redis-hashed OTP (we own the code, `sms.js` only sends).
37. Forgot-password (same token-in-Redis pattern as email verify).
38. **OAuth2 (pending)** — “Sign in with …” instead of password; still issue our access JWT + httpOnly refresh after Google/GitHub says who they are.
39. Provider 1: Google (Gmail account).
40. Provider 2: GitHub (or Apple) — same callback pattern, different client id/secret.
41. Link providers to one user by email so Google and GitHub don’t create two accounts.
42. **Tests (pending, skip for now)** — automated checks for login, refresh, logout, and task CRUD; not building them yet.
