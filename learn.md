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

**File:** `app.js` lines 54–62

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
      ├── res.json()     → success response
      ├── res.status(401) → auth fail (direct)
      └── next(e)        → error handler
```

---

## Quick reference table

| Line in `app.js` | One line |
|------------------|----------|
| `require('dotenv/config')` | Load secrets from `.env` |
| `cors({ origin: ... })` | Which frontends can call API from browser |
| `express.json()` | Parse JSON request body → `req.body` |
| `express.urlencoded()` | Parse form request body → `req.body` |
| `express.static('public')` | Serve static files |
| 404 handler | Unknown route → JSON 404 |
| Error handler `(err,...)` | Crashes → JSON 400/500 |
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

#### Security response headers (Helmet — future)

| Header | Purpose | Status |
|--------|---------|--------|
| **`Strict-Transport-Security`** | Force HTTPS | ❌ on deploy + Helmet |
| **`X-Content-Type-Options`** | Prevent MIME sniffing | ❌ Helmet |
| **`X-Frame-Options`** | Clickjacking protection | ❌ Helmet |
| **`Content-Security-Policy`** | Control loaded resources | ❌ Helmet |

#### Custom / tracing (future)

| Header | Purpose |
|--------|---------|
| **`X-Request-Id`** | Trace one request in logs |
| **`X-Correlation-Id`** | Link microservice calls |

---

### Quick cheat sheet — by route

| Request | Headers to send |
|---------|-----------------|
| `POST /auth/register` | `Content-Type: application/json` |
| `POST /auth/login` | `Content-Type: application/json` |
| `GET /tasks` | `Authorization: Bearer <token>` |
| `POST /tasks` | `Content-Type` + `Authorization` |
| `PATCH /tasks/:id` | `Content-Type` + `Authorization` |
| `DELETE /tasks/:id` | `Authorization` only |
| `DELETE /tasks/bulk` | `Content-Type` + `Authorization` |
| `POST /tasks/bulk` | `Content-Type` + `Authorization` |

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

See also: [`readme.md`](readme.md) HTTP headers section, [`authflow.md`](authflow.md) for JWT in `Authorization`.

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

