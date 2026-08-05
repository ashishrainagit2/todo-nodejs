# Auth Flow — Todo API (JWT)

A gentle, step-by-step guide to how signup, login, and protected routes work in this project.

---

## Progress legend (from readme)

| Icon | Meaning |
|------|---------|
| ✅ | Completed |
| 💡 | In progress |
| ❌ | Pending |

---

## Big picture (3 acts)

```
Act 1: Register / Login  →  you get a token (key card)
Act 2: Send request      →  you show the token at the door
Act 3: protect           →  server checks token, lets you in
```

**Authentication** = *Who are you?* (login, JWT, `protect`)  
**Authorization** = *What can you do?* (only your tasks — Point 4, not fully implemented yet)

---

## What you need (backend)

| Piece | File | Purpose |
|-------|------|---------|
| User model | `models/user.js` | Store email, password, role |
| Auth routes | `routes/auth.js` | `POST /auth/register`, `POST /auth/login` |
| Auth controller | `controllers/auth.js` | Signup logic, issue JWT |
| **`protect` middleware** | `middleware/auth.js` | Check token on protected routes |
| Task routes | `routes/task.js` | `router.use(protect)` before all `/tasks` |
| Env secrets | `.env` | `JWT_SECRET`, `JWT_EXPIRES_IN` |

### Packages used

- `jsonwebtoken` — create & verify tokens
- `bcryptjs` — installed, password hashing not fully done yet

### Env variables

```
DB_CONNECTION=mongodb://localhost:27017/todo-app
PORT=3005
JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=7d
```

---

## Public vs protected routes

| Route | Needs token? |
|-------|----------------|
| `POST /auth/register` | No |
| `POST /auth/login` | No (login incomplete — see below) |
| `GET /` | No |
| `GET /tasks` | **Yes** |
| `POST /tasks` | **Yes** |
| `GET /tasks/:id` | **Yes** |
| `PATCH /tasks/:id` | **Yes** |
| `DELETE /tasks/:id` | **Yes** |
| `DELETE /tasks/bulk` | **Yes** |

In `routes/task.js`:

```js
router.use(protect);  // gate before all task routes
```

---

# Point 1 — What happened when you registered

You sent:

```
POST /auth/register
{ "email": "...", "password": "..." }
```

### Behind the scenes

```
Postman/Browser
      ↓
app.js  →  sees /auth  →  routes/auth.js
      ↓
routes/auth.js  →  POST /register  →  register controller
      ↓
controllers/auth.js:
   1. User.create(...)     → saves user in MongoDB (users collection)
   2. jwt.sign(...)        → creates token with userId inside
   3. res.json({ token })  → sends token back to you
```

Two things were created:

| Thing | Where | Purpose |
|-------|--------|---------|
| **User** | MongoDB `users` collection | Who you are (email, password) |
| **Token** | Sent to browser/Postman | Proof you're logged in |

### Token creation (your code)

```js
const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);
```

### What's inside the token?

Looks like gibberish: `eyJhbGciOiJIUzI1NiIs...` (3 parts separated by dots)

Inside (simplified):

```json
{
  "userId": "your_mongodb_id",
  "exp": "expires in 7 days"
}
```

Signed with `JWT_SECRET` — nobody can fake it without that secret.

**Important:** The server does **not** store the token in a database. You keep it; you send it back on each request.

---

# Point 2 — You call `GET /tasks` with the token

You send:

```
GET http://localhost:3005/tasks
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Step 1 — Request enters Express

```
Postman/Browser
      ↓
app.js
  → cors()
  → express.json()
  → app.use('/tasks', TaskRoutes)
```

### Step 2 — `protect` runs first (the gate)

```js
router.use(protect);   // runs BEFORE getTasks
router.get('/', getTasks);
```

### Step 3 — Read the header

```js
if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
}
```

| Header value | What code extracts |
|--------------|-------------------|
| `Bearer eyJhbG...` | `eyJhbG...` (token only) |

**No header?** → **401** `"Not authorized, no token"` → controller never runs.

### Step 4 — Verify the token

```js
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// decoded = { userId: "6a70...", iat: ..., exp: ... }
```

| Result | What happens |
|--------|----------------|
| Valid | Continue |
| Fake / expired / tampered | **401** `"Not authorized, invalid token"` |

Same `JWT_SECRET` used to **create** (register) and **verify** (protect).

### Step 5 — Load user from database

```js
const user = await User.findById(decoded.userId).select('-password');
```

Why hit DB again?
- Confirm user still exists
- Get fresh data (email, role)
- Never attach password to `req.user`

**User not found?** → **401** `"User no longer exists"`

### Step 6 — Attach user to request

```js
req.user = user;
next();  // continue to controller
```

### Step 7 — Controller runs

Only after `protect` passes → `getTasks()` runs → returns JSON.

### Visual flow

```
GET /tasks + Bearer token
        ↓
   protect middleware
        ↓
   Token in header?  ──no──→ 401
        ↓ yes
   jwt.verify OK?    ──no──→ 401
        ↓ yes
   User in DB?       ──no──→ 401
        ↓ yes
   req.user = user
   next()
        ↓
   getTasks()  →  200 + JSON
```

### Two types of 401

| Message | Meaning |
|---------|---------|
| `"Not authorized, no token"` | Forgot Authorization header |
| `"Not authorized, invalid token"` | Wrong/expired/malformed token |
| `"User no longer exists"` | Token OK but user deleted |

---

# Point 3 — Sending the token on every protected request

After register, the token lives **on your side** (Postman, browser). The server **does not remember** your login. Each `/tasks` request must **carry the token again**.

### Where the token lives (client)

| Tool | Where |
|------|--------|
| **Postman** | Authorization tab → Bearer Token |
| **Browser (later)** | localStorage / memory |
| **Mobile (later)** | Secure storage |

### How to send it (required format)

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
              ^^^^^^^ ^^^^^^^^^^^^^^^^^^^^
              word    your token
```

**Wrong:**

```
Authorization: eyJhbG...     ❌ missing "Bearer"
Body: { "token": "..." }     ❌ protect doesn't read body
?token=eyJhbG...             ❌ protect doesn't read query
```

### Postman steps

1. Open request (e.g. `GET /tasks`)
2. **Authorization** tab
3. Type: **Bearer Token**
4. Paste token
5. Send

### If you forget the token

```
GET /tasks (no header)
  → protect → 401 "Not authorized, no token"
  → getTasks NEVER runs
```

### Mental model

```
Register once  →  get key card (token)
Every /tasks   →  swipe key card (header)
Server         →  doesn't keep your card on file
```

HTTP is **stateless** — each request is independent.

---

# Point 4 — Each user sees only their tasks (planned)

**Status: ❌ Not implemented yet** (explained only)

Right now `protect` sets `req.user`, but task controllers **ignore it**:

```js
Task.find(filter);                    // ALL tasks
Task.findById(req.params.id);           // ANY task by id
```

### The fix (when you implement)

**1. Add `user` field to Task model:**

```js
user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
}
```

**2. Create task — attach owner:**

```js
new Task({
    title,
    description,
    user: req.user._id   // from protect
})
```

**3. Get all — filter by owner:**

```js
const filter = { user: req.user._id };
// then add status, priority, etc.
Task.find(filter)
```

**4. Get/update/delete one — check owner:**

```js
Task.findOne({ _id: req.params.id, user: req.user._id })
```

So User B cannot read User A's task even if they guess the id.

### Auth vs authorization

| | Question | Where |
|---|----------|--------|
| **Authentication** | Who are you? | `protect` → JWT → `req.user` |
| **Authorization** | Can you access this? | Controller filters by `user: req.user._id` |

---

## JWT vs sessions (why JWT)

| | **JWT** (this project) | **Session (cookie)** |
|---|------------------------|----------------------|
| Login state | Token on client | Session ID in cookie |
| Server memory | Stateless | Needs session store |
| API/mobile friendly | ✅ | Harder |

---

## Full signup → protected API flow

```
1. POST /auth/register
   → User saved in MongoDB
   → jwt.sign({ userId })
   → Response: { token, user }

2. POST /tasks (or GET /tasks)
   Header: Authorization: Bearer <token>

3. app.js → routes/task.js → protect
   → read header
   → jwt.verify
   → User.findById
   → req.user = user
   → next()

4. controller runs (getTasks, createTask, etc.)
```

---

## Related project setup (already done)

### REST routes (renamed earlier)

```
GET    /tasks
GET    /tasks/:id
POST   /tasks
PATCH  /tasks/:id
DELETE /tasks/:id
DELETE /tasks/bulk
POST   /auth/register
POST   /auth/login
```

### Controllers split

- `routes/task.js` — URLs only
- `controllers/task.js` — task logic
- `routes/auth.js` — auth URLs
- `controllers/auth.js` — register (login incomplete)

### Error handling

- **404** in `app.js` — unknown routes → JSON (not HTML)
- **Global error handler** in `app.js` — `next(err)` from controllers
- Controllers use `next(e)` in catch blocks

### Bugs fixed during auth work

| Issue | Fix |
|-------|-----|
| `routes/auth.js` missing export | Added `module.exports = router` |
| `models/user.js` missing export | Added `module.exports = mongoose.model(...)` |
| `jwt` not imported in auth controller | Added `require('jsonwebtoken')` |
| Register not returning token properly | Returns `{ token, user }` now |

---

## Still pending (auth-related)

- ❌ **Login** — started but incomplete (no password check, no token returned)
- ❌ **Password hashing** — bcrypt installed, passwords stored plain text for now
- ❌ **Point 4** — link tasks to `req.user._id`
- ❌ **Role-based authorization** — e.g. admin vs user (`authorize` middleware)
- ❌ **Frontend** — signup/login pages, store token, attach to requests

---

## Postman quick test

**Register:**
```
POST http://localhost:3005/auth/register
Body (JSON):
{ "email": "test@example.com", "password": "password123" }
```

**Protected route (with token):**
```
GET http://localhost:3005/tasks
Authorization: Bearer YOUR_TOKEN_HERE
```

**Protected route (without token):**
```
GET http://localhost:3005/tasks
→ 401 { "message": "Not authorized, no token" }
```

---

## Suggested next steps (one at a time)

1. Finish **login** (bcrypt + return token)
2. Implement **Point 4** (task ownership)
3. Add **password hashing** on register
4. Build **frontend** signup/login pages

---

> Pick one topic, say which step you want, and implement together.

---

## Real ID vs JWT (no DB on each request)

| Real world | JWT (no DB on each request) |
|------------|-----------------------------|
| Person shows ID card | Client sends token |
| Clerk checks: "Is this a real government ID?" | Server checks: "Is this signature valid?" |
| Clerk checks: "Is it expired?" | Server checks: `exp` is in the future |
| Clerk looks up person in computer / compares photo | **Optional** — your DB check on line 18 |
| Reference = government records + photo on file | Reference = **`JWT_SECRET`** (only your server knows it) |

So when you said: *"valid JWT, expiry in future — only secret mismatch fails"* — **yes**, for the no-database case that's correct.

---

## What is the token matched against?

Not a user record. Not a picture. Not MongoDB.

It's matched against this one question:

**"If I (the server) take this payload (`userId`, `iat`, `exp`) and sign it with my `JWT_SECRET`, do I get the same signature that's on the token?"**

```js
jwt.verify(token, process.env.JWT_SECRET);
```

Under the hood that means:

1. Read payload from token
2. Recompute signature using `JWT_SECRET`
3. Compare with signature on the token
4. Check `exp`

If both pass → token is valid. **No lookup needed.**

The "computer system" in JWT world is **math + the secret**, not a user table.

---

## ID analogy, more precisely

**Showing ID at the door (each `/tasks` request):**

- You're not asking "who is this person?" from scratch every time
- You're asking "**did our office issue this pass?**" and "**is it still valid?**"

The pass itself carries:

| Field on pass | JWT field | Meaning |
|---------------|-----------|---------|
| Name / ID number | `userId` | Who it's for |
| Issue date | `iat` | When issued |
| Expiry date | `exp` | When it stops working |
| Anti-forgery stamp | **signature** | Made with `JWT_SECRET` |

The stamp is verified against **the same stamp machine** (your secret), not against a live photo database.

---

## When was the "real person" checked?

That happened **once**, at **login/register** — when you still used the DB:

```
Register/Login
  → check email/password in DB   ← like verifying identity at the front desk once
  → jwt.sign({ userId }, JWT_SECRET)
  → give token to client
```

After that, every request only proves:

> "This is the same pass we issued at login, and it hasn't expired."

So the DB was the "picture match" **at login time**.  
On later requests, JWT trusts that **past check**, until the token expires.

---

## Why secret mismatch = invalid

Anyone can **read** `userId` from a token (`decode`).  
Only someone who knows `JWT_SECRET` can **create** a token whose signature verifies.

| Attack | Result |
|--------|--------|
| Attacker changes `userId` in payload | Signature no longer matches → **invalid** |
| Attacker makes fake token with random signature | Doesn't match secret → **invalid** |
| Attacker steals real token before expiry | **Valid** (same as stolen ID card) |
| Token expired | **Invalid** |

---

## One sentence summary

**JWT without DB is matched against `JWT_SECRET`, not against a user record** — the signature proves your server issued that `userId` at login/register, and `exp` proves the pass is still good.

The database check later is optional extra safety ("does this person still exist?"), like checking the guest list even though the wristband stamp is real.

---

## How is the token created?

In register (`controllers/auth.js`):

```js
const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);
```

`jwt.sign()` builds one string with **3 parts**:

```
header . payload . signature
```

---

## Token ingredients (besides the secret)

| # | Ingredient | Who provides it | In your code |
|---|------------|-----------------|--------------|
| 1 | **Payload** | You | `{ userId: user._id }` |
| 2 | **Expiry** | You (via options) | `expiresIn: '7d'` |
| 3 | **Algorithm** | Library default | `HS256` (HMAC + SHA-256) |
| 4 | **Header** | Library auto-builds | `{ alg: "HS256", typ: "JWT" }` |
| 5 | **Issued-at (`iat`)** | Library auto-adds | Current timestamp when signed |
| 6 | **Expiry (`exp`)** | Library auto-adds | Calculated from `expiresIn` |
| 7 | **Secret** | You (`.env`) | `JWT_SECRET` |

Besides the secret, you explicitly choose:

- **What to store** → `userId`
- **How long it lives** → `7d`

The library adds `iat`, `exp`, header, and signature.

---

## Step-by-step (inside `jwt.sign`)

```
1. You pass payload:     { userId: "6a71fb..." }

2. Library adds time fields:
                         { userId: "6a71fb...", iat: 1785854752, exp: 1786459552 }

3. Library builds header:
                         { alg: "HS256", typ: "JWT" }

4. Both are base64url-encoded:
   header  → eyJhbGciOiJIUzI1NiIs...
   payload → eyJ1c2VySWQiOiI2YTcxZmI...

5. Library signs with secret:
   signature = HMAC-SHA256(
     header + "." + payload,
     JWT_SECRET
   )

6. Final token:
   header.payload.signature
```

---

## Token structure (visual)

```
┌─────────────────────────────────────────────────────────┐
│  HEADER (auto)                                          │
│  { alg: "HS256", typ: "JWT" }                           │
├─────────────────────────────────────────────────────────┤
│  PAYLOAD (you + library)                                │
│  { userId: "...",  iat: ...,  exp: ... }                │
│     ↑ you chose      ↑ auto    ↑ from expiresIn         │
├─────────────────────────────────────────────────────────┤
│  SIGNATURE (secret + math)                              │
│  HMAC(header + payload, JWT_SECRET)                     │
└─────────────────────────────────────────────────────────┘
         ↓
   one long string sent to client
```

---

## What you chose vs what the library adds

| Field | Source |
|-------|--------|
| `userId` | **You** — from DB after register |
| `expiresIn: '7d'` | **You** — in options |
| `JWT_SECRET` | **You** — in `.env` |
| `iat` | **Library** — "issued at" now |
| `exp` | **Library** — now + 7 days |
| `alg`, `typ` | **Library** — header defaults |
| signature | **Library** — uses secret + header + payload |

---

## Optional payload fields (not in your code yet)

You *could* also put in the payload:

```js
jwt.sign(
  {
    userId: user._id,
    email: user.email,   // optional — usually avoid (token is readable)
    role: user.role      // optional — role in token
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
```

**Rule:** keep payload small — only put IDs or roles you need on every request. Email and password never go in the token.

---

## One sentence summary (token creation)

**Token = your data (`userId`) + time (`iat`, `exp`) + header + signature made with `JWT_SECRET`.**

The secret doesn't go *inside* the token — it's used to **stamp** the token so `jwt.verify` can check the stamp later.

---

## What `jwt.verify(token, secret)` does

When you send your token back on a protected request:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTcxZmIyMDJmNTYyOGIwY2ExOWRjYmYiLCJpYXQiOjE3ODU4NTQ3NTIsImV4cCI6MTc4NjQ1OTU1Mn0.McwkF6u_fQveboOQSEB4F-Y6LgEK-__guwlrIF8e7oo
```

```js
jwt.verify(token, process.env.JWT_SECRET);
// same as: jwt.verify(token, 'dqwdasasdasdw23e231ddasdasdasd1256vfvsvs')
```

Your token has **3 dot-separated parts**:

```
part1 . part2 . part3
header  payload signature
```

| Part | Your token (first chars) | Decoded meaning |
|------|--------------------------|-----------------|
| **Header** | `eyJhbGciOiJIUzI1NiIs...` | `{ "alg": "HS256", "typ": "JWT" }` |
| **Payload** | `eyJ1c2VySWQiOiI2YTcxZmI...` | `{ "userId": "6a71fb...", "iat": 1785854752, "exp": 1786459552 }` |
| **Signature** | `McwkF6u_fQveboOQSEB4F...` | Not readable — proof the first two parts are genuine |

---

### What each term means

| Term | Simple meaning | In your token |
|------|----------------|---------------|
| **Header** | Metadata about the token — how it was signed | `alg: HS256` (algorithm), `typ: JWT` |
| **Payload** | The actual data inside the token (anyone can read it) | `userId`, `iat`, `exp` |
| **Secret** | Private key in `.env` — **never sent to client**, never inside the token | `JWT_SECRET` in your `.env` |
| **HMAC** | One-way math: `header + payload + secret` → unique signature string | Produces part 3 (`McwkF6u_fQve...`) |

**Header** = label on the envelope ("signed with HS256").  
**Payload** = letter inside ("this is for userId X, valid until exp").  
**Secret** = your server's private stamp ink (only you have it).  
**HMAC** = the stamping machine — mixes header + payload + secret into the signature.

---

### The 3 checks (no database)

1. **Re-sign** — take header + payload, run **HMAC** with your **secret**, compare result to part 3 (`McwkF6u_fQve...`)
2. **Check expiry** — is `exp` (`1786459552`) still in the future?
3. **Check format** — is it a valid JWT (3 parts, valid base64)?

| Result | What happens |
|--------|--------------|
| **Pass** | Returns `{ userId, iat, exp }` → middleware continues |
| **Fail** | Throws error → **401** "Not authorized, invalid token" |

**In one line:** It asks *"Did **we** sign this, and is it still valid?"* — not *"Does this user exist in MongoDB?"*


So basically it check if last part is generated again from secret, header and payload and HMAC

which directly means it checks secretkey???

Yes — that's the idea.

jwt.verify doesn't compare the secret as plain text. It:

Takes header + payload from the token
Runs HMAC with your secret
Compares the result to the third part (signature)
If they match → whoever created the token used the same secret as your server.

So checking the signature is checking the secret — indirectly, through math.

Same secret  →  same HMAC output  →  signature matches  →  valid ✅
Wrong secret →  different output   →  no match           →  invalid ❌
That's why the secret must stay private: anyone with it can mint valid tokens. The signature is proof they knew the key.