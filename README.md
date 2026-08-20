# Todo API

Simple Node.js + Express + MongoDB todo backend.

**Run:** `npm run start`  
**Base URL:** `http://localhost:3005/api/v1`

All resource routes are versioned — `/api/v1/tasks`, `/api/v1/auth/login`. `GET /health` sits **outside** the version (it reports on the server, not the API contract).

> Learning sections further down often write short paths like `POST /auth/register` when explaining concepts; the real path is `/api/v1/auth/register`.

---

## Progress legend

| Icon | Meaning |
|------|---------|
| ✅ | Completed |
| 💡 | In progress |
| ❌ | Pending |

---

## ✅ Completed

- ✅ Express server setup
- ✅ MongoDB connection (Mongoose)
- ✅ Task model & schema
- ✅ REST CRUD routes
- ✅ Controllers folder (routes + controllers split)
- ✅ Create task — `POST /api/v1/tasks`
- ✅ Get all tasks — `GET /api/v1/tasks`
- ✅ Get one task — `GET /api/v1/tasks/:id`
- ✅ Update task — `PATCH /api/v1/tasks/:id`
- ✅ Delete one task — `DELETE /api/v1/tasks/:id`
- ✅ Delete many tasks — `DELETE /api/v1/tasks/bulk`
- ✅ Filter by status — `?status=pending`
- ✅ Filter by priority — `?priority=high`
- ✅ Filter by tag — `?tag=work`
- ✅ Search — `?search=meeting`
- ✅ Sort — `?sort=-createdAt`
- ✅ CORS configured (`CORS_ORIGIN_DEV` / `CORS_ORIGIN` + `NODE_ENV`)
- ✅ PORT from `.env`
- ✅ Schema enum fix (`status`, `priority`)
- ✅ 404 handler (unknown routes)
- ✅ Global error handler
- ✅ JWT auth — register, login, `protect`
- ✅ Password hashing (bcrypt)
- ✅ Task ownership — `userId` on all task routes
- ✅ Bulk create — `POST /api/v1/tasks/bulk` (max 10 per request)
- ✅ `.gitignore` + `.env.example`
- ✅ Unique email on user
- ✅ Rate limiting — `express-rate-limit` on `/tasks` and `/auth` (see [Rate limiting](#rate-limiting))
- ✅ Global error mapping — `CastError` → **400**, `ValidationError` → **400**, duplicate email → **409** (see [API error handling](#api-error-handling))
- ✅ Unique email enforced — `User.syncIndexes()` on startup + `findOne` check on register
- ✅ Auto-update `updatedAt` on PATCH — schema `{ timestamps: true }` + allowlisted fields
- ✅ Stronger input validation — hand-rolled, shared by create / update / bulk (no library); field-level `errors[]`, trim + enum normalising, array caps, past-date and date-order rules, unknown-field rejection, `:id` checked before the DB
- ✅ Helmet — safe HTTP headers, `app.use(helmet())` as first middleware (see [`learn.md` §10b](learn.md#10b-safe-http-headers--what-helmet-actually-does))
- ✅ Request logging — `morgan` (`dev` locally, `combined` + `logs/access.log` in dev; stdout only in production), `/health` skipped
- ✅ Request context — `AsyncLocalStorage` request id (`X-Request-Id`) + `userId` after JWT; morgan (`:id :user`) and every pino line share both
- ✅ Structured logs — `pino` (`utils/logger.js`); `mixin` stamps `requestId` / `userId` on every line, `pino-pretty` locally, JSON to stdout in production
- ✅ Outbound timeouts — `utils/httpClient.js` (`AbortController` + `setTimeout`, default 3s) → `504 ERR_UPSTREAM_TIMEOUT` with the abort kept as `cause` (see [`learn.md` §20](learn.md#20-timeouts--abortcontroller-and-resource-starvation))
- ✅ Health check — `GET /health` → **200** `{ status, db, uptime }`, **503** when MongoDB is not connected
- ✅ API versioning — all routes under `/api/v1` via `routes/v1.js` + one prefix in `app.js` (see [`learn.md` §13](learn.md#13-api-versioning--apiv1))
- ✅ Pagination — `GET /api/v1/tasks?page=&limit=` returns `{ data, page, limit, total, totalPages }` (default page 1, limit 10, max 100)
- ✅ `AppError` + consistent error JSON — `{ success, status, message, errors[] }`; unknown 500s hidden in production
- ✅ Malformed JSON body → **400**
- ✅ Swagger — `/api-docs` and `/api-docs.json`
- ✅ Cluster entry — `npm run start:cluster` → `server.js` (in-memory rate limit still per-worker)

---

## ❌ Pending

Accurate against the code (not old checklists). Next three: **indexes → escape search regex → tests**.

### API features

- Date filters (`?dueBefore=`, overdue)
- `PATCH /tasks/:id/complete`
- Role checks (`role` exists, never used → no 403)
- Escape `?search` for `$regex`
- File uploads (`multer`; `attachments` is still `[String]`)
- Nested subTasks / comments as real objects

### Database / speed

- Indexes on `userId`, `status`, `dueDate` (or `{ userId, createdAt }`)
- In-memory cache, then Redis
- `.lean()` / `.select()` on list
- Response compression

### Hardening

- Redis-backed rate limit (in-memory breaks under cluster)
- `app.set('trust proxy', 1)` when anything sits in front

### Timeouts and retries (resource starvation)

A hung dependency holds a socket, a connection-pool slot and memory until it answers. Without a deadline, someone else's slow server decides how much of your memory to consume. Full walkthrough in [`learn.md` §20](learn.md#20-timeouts--abortcontroller-and-resource-starvation) and [§21](learn.md#21-retries--exponential-backoff-and-jitter).

✅ **Done — outbound HTTP timeouts.** `utils/httpClient.js` wraps every `fetch` in an `AbortController` + `setTimeout` (cleared in `finally`), default 3000ms via `HTTP_TIMEOUT_MS`. On our deadline it throws `504 ERR_UPSTREAM_TIMEOUT` with the `AbortError` as `cause`. Prove it: `?case=hang` spins forever, `?case=weather-timeout` fails at ~3s.

✅ **Done — retries with backoff + jitter.** Same file. Two retries by default (`HTTP_RETRIES`) on transient failures only — timeouts, network errors, and `408 / 425 / 429 / 500 / 502 / 503 / 504`. Each wait is a random slice of a doubling window (`300 → 600 → 1200ms`, capped at `HTTP_MAX_BACKOFF_MS`), so instances don't retry in lockstep and hammer a recovering server. `Retry-After` wins over our math, `POST` is never replayed, and a caller-cancelled request never retries. Exhausted attempts throw `503 ERR_UPSTREAM_UNAVAILABLE`. Prove it: `?case=retry` — 4 attempts, and the waits differ every run.

- ❌ **Mongo timeouts** — `mongoose.connect` uses defaults today (`serverSelectionTimeoutMS` 30s, no `socketTimeoutMS`), so a stalled query can hang a request far longer than a user will wait
- ❌ **Server request timeout** — `server.requestTimeout` / `headersTimeout`, so a handler that hangs for any reason cannot hold a connection open indefinitely
- ❌ **Circuit breaker** — retries ride out a blip, but if an upstream is hard down for an hour, every request still pays 4 attempts before failing. A breaker trips after N failures and fails fast

### Observability

Today: `morgan` access lines (terminal + `logs/access.log`), `pino` structured logs with `requestId` / `userId`, and `GET /health`. Still only the **logs** pillar — see [Observability — implemented vs remaining](#observability--implemented-vs-remaining).

- Metrics — `prom-client` + `GET /metrics` (p50 / p95 / p99 per route; outside `/api/v1`)
- Error tracking — Sentry (or similar) on top of the pino stream
- Tracing — OpenTelemetry / APM (when more than one service)
- Alerting — error rate or p95 on the host dashboard
- Uptime checks — probe `/health` from outside after deploy

### Quality / ship

- Tests (Supertest) — `npm test` is still a stub
- MongoDB Atlas + deploy (Render / Railway / Fly)
- Prod env vars, HTTPS
- CI (GitHub Actions: test on PR, then auto-deploy)

### Frontend (last)

- React / Next.js client, token on `Authorization`, error/loading UI

---

## API quick reference

Prefix every route below with `/api/v1`.

| Method | URL | Action |
|--------|-----|--------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Get JWT |
| GET | `/api/v1/tasks` | Get a page of tasks (filter, search, sort, `?page=&limit=`) |
| GET | `/api/v1/tasks/:id` | Get one |
| POST | `/api/v1/tasks` | Create |
| POST | `/api/v1/tasks/bulk` | Create many (max 10) |
| PATCH | `/api/v1/tasks/:id` | Update |
| DELETE | `/api/v1/tasks/:id` | Delete one |
| DELETE | `/api/v1/tasks/bulk` | Delete many |
| GET | `/health` | Server + DB status (**unversioned**) |

### Examples

```
GET  /api/v1/tasks?status=pending&priority=high&sort=-dueDate&page=1&limit=10
GET  /api/v1/tasks?search=meeting&tag=work
POST /api/v1/tasks          (JSON body)
PATCH /api/v1/tasks/:id     (JSON body)
DELETE /api/v1/tasks/bulk   { "ids": ["id1", "id2"] }
```

### Why version at all

| Reason | Example |
|--------|---------|
| **Breaking changes without breaking clients** | v1 returns `{ message }` on errors, v2 returns `{ success, status, errors[] }` — both can run at once |
| **Clients migrate on their own schedule** | Old mobile app keeps calling v1 while the web app moves to v2 |
| **Honest deprecation** | v1 stays live, announced as deprecated, removed on a date |

**Implementation:** `routes/v1.js` mounts `/tasks` and `/auth` (with their rate limiters); `app.js` mounts that router at one `V1_PREFIX` constant. A v2 would be `routes/v2.js` plus one more `app.use` — no edits inside individual route files.

---

## HTTP headers (this project)

Headers are **metadata** sent with requests and responses — not in the URL or body.

### Headers you must send (client → API)

| Header | When required | Value | Example route |
|--------|---------------|-------|---------------|
| **`Content-Type`** | POST / PATCH with JSON body | `application/json` | `POST /api/v1/tasks`, `POST /api/v1/auth/register` |
| **`Authorization`** | All `/api/v1/tasks` routes | `Bearer <token>` | `GET /api/v1/tasks`, `POST /api/v1/tasks`, etc. |

**Register / login** — need `Content-Type` only (no token yet).

**Tasks** — need **both** (login first, copy token).

### Postman examples

**Register / login:**
```
Content-Type: application/json
```

**Protected task route:**
```
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Headers the browser sends automatically

| Header | Who sends | Purpose in this project |
|--------|-----------|-------------------------|
| **`Origin`** | Browser (Next.js) | CORS check — must match `CORS_ORIGIN_DEV` or `CORS_ORIGIN` |
| **`Host`** | Client | Which server (`localhost:3005`) |

Postman often omits `Origin` — that's why CORS issues mainly appear in the browser, not Postman.

### Headers the server sends back (response)

| Header | Set by | Purpose |
|--------|--------|---------|
| **`Content-Type`** | Express `res.json()` | `application/json` — body is JSON |
| **`Access-Control-Allow-Origin`** | `cors()` middleware | Which frontend may read the response |
| **`Access-Control-Allow-Credentials`** | `cors({ credentials: true })` | Allows auth headers cross-origin |

### Headers not used yet (future)

| Header | Purpose | Status |
|--------|---------|--------|
| `Accept` | Client says what format it wants back | Optional — JSON default |
| `Cookie` / `Set-Cookie` | Session auth alternative to JWT | ❌ not implemented |
| `X-Request-Id` | Trace one request across logs | ❌ future |
| Security headers (`Helmet`) | `X-Content-Type-Options`, `X-Frame-Options`, CSP, HSTS | ✅ `app.use(helmet())` |
| `RateLimit-*` | Requests left, window reset | ✅ on `/tasks` and `/auth` |

See [`learn.md`](learn.md) section 10 for header types explained in depth.

---

## API error handling

**Goal:** Every API failure returns the **exact, appropriate error** — correct status code + clear JSON message. No vague 500s when a 400 or 404 fits. No HTML crash pages.

### Failure categories

| Category | Meaning | Status | Example in this API |
|----------|---------|--------|---------------------|
| **Route not found** | URL doesn't exist | `404` | `GET /taskss` |
| **Resource not found** | Valid route, missing / not yours | `404` | `GET /tasks/:id` — wrong id or other user's task |
| **Bad request** | Wrong body shape or params | `400` | Bulk body missing `tasks` array |
| **Validation** | Data fails schema/rules | `400` / `422` | POST task without `title` |
| **Unauthorized** | Not logged in / bad token | `401` | `GET /tasks` without Bearer token |
| **Forbidden** | Logged in, not allowed | `403` | Normal user on admin route *(future)* |
| **Conflict** | Already exists | `409` | Register same email twice |
| **Server error** | Bug, DB down, unhandled | `500` | MongoDB connection lost mid-request |

**Rule:** `4xx` = client/auth issue. `5xx` = server issue.

### Implemented — global error handler (`app.js`)

| Step | Mongoose / Mongo error | Status | Response message |
|------|------------------------|--------|------------------|
| ✅ 1 | `CastError` (invalid `:id`) | **400** | `Invalid id format` |
| ✅ 2 | Duplicate email (`11000`) | **409** | `Email already registered` |
| ✅ 2b | Duplicate email (`findOne`) | **409** | `Email already registered` via `next(err)` + `err.status` |
| ✅ 3 | `ValidationError` (schema) | **400** | Joined field messages from `err.errors` |

**Controller pattern:** expected cases return directly (`404` task not found); unexpected → `catch (e) { next(e); }` → global handler.

**Register duplicate flow:** `findOne` → `next(err)` with `status: 409` **or** `User.create` hits unique index → `11000` → global handler. Requires `User.syncIndexes()` so `email` unique index exists in MongoDB.

### Where errors are handled today

```
Request
   │
   ▼
 Middleware (cors, json, rate limit, protect)  → 429 if over limit; 401 if no/bad token
   │
   ▼
 Controller                        → 400 checks, 404 not found, 201/200 success
   │                                 → next(e) for unexpected
   ▼
 404 handler                        → unknown route
   │
   ▼
 Global error handler               → CastError → 400, ValidationError → 400,
                                      11000 / err.status → 409, else → 500
```

| Layer | Handles |
|-------|---------|
| **Middleware** | Rate limit (`429`), auth (`401`), CORS (browser block) |
| **Controller** | Expected errors — bad body (`400`), not found (`404`), duplicate email (`next` → **409**) |
| **404 handler** | Route doesn't exist |
| **Global error handler** | `CastError`, `ValidationError`, `11000`, custom `err.status` |

### Two controller patterns

**Expected** — return directly:
```js
if (!task) {
    return res.status(404).json({ message: 'Task not found' });
}
```

**Unexpected** — pass up:
```js
} catch (e) {
    next(e);
}
```

### Status code cheat sheet

| Code | When |
|------|------|
| `200` | GET / PATCH success |
| `201` | POST created |
| `400` | Invalid body, missing fields, bad id format |
| `401` | Not logged in, invalid token, wrong password |
| `403` | Logged in but not allowed |
| `404` | Route or resource not found |
| `409` | Duplicate email, conflict |
| `422` | Validation (alternative to 400) |
| `429` | Rate limit exceeded — too many requests from this IP |
| `500` | Internal server error — hide details in production |

### Postman quick tests (error handling)

| Test | Request | Expected |
|------|---------|----------|
| Bad id | `GET /tasks/not-valid-id` + Bearer | **400** `Invalid id format` |
| Duplicate register | `POST /auth/register` same email twice | **409** `Email already registered` |
| Missing title | `POST /tasks` `{ "description": "x" }` + Bearer | **400** `Path \`title\` is required.` |
| Not found | `GET /tasks/<valid-id-not-yours>` + Bearer | **404** `Task not found` |

### Target response shape *(future)*

Today: `{ "message": "..." }`

Goal:
```json
{
  "success": false,
  "status": 404,
  "message": "Task not found",
  "errors": [
    { "field": "title", "message": "Title is required" }
  ]
}
```

### Mental model

```
Wrong URL?              → 404 (route handler)
Resource missing?       → 404 (controller)
Bad body / token?       → 400 / 401 (controller or middleware)
Too many requests?      → 429 (rate limit middleware)
Not allowed?            → 403 (middleware — future)
Something exploded?     → 500 (error handler)
```

See also: `learn.md` (middleware Q&A), `todo.md` #18 structured errors.

---

## Rate limiting

Cap how many requests one client (IP) can send per time window. Over the limit → **`429`** with JSON message — controller never runs.

**Deep dive:** [`learn.md` section 11](learn.md#11-rate-limiting--what-it-is-strategies-what-we-use) (strategies, browser vs Postman, production notes).

### What we implemented

| Piece | Detail |
|-------|--------|
| **Package** | `express-rate-limit` |
| **File** | `middleware/rateLimit.js` |
| **Mounted in** | `app.js` — before route handlers |
| **Strategy** | Fixed window, **per IP**, in-memory store |
| **Two tiers** | Stricter on `/auth` than `/tasks` |

| Limiter | Routes | Env var | Default |
|---------|--------|---------|---------|
| `authLimiter` | `/auth/*` | `RATE_LIMIT_AUTH_MAX` | 10 / 15 min |
| `apiLimiter` | `/tasks/*` | `RATE_LIMIT_MAX` | 10 / 15 min |
| Both | — | `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) |

### Response when blocked

```json
{ "message": "Too many requests, please try again later" }
```

Headers: `RateLimit-Policy`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

### Strategies (overview)

| Type | Examples | We use |
|------|----------|--------|
| **Algorithm** | Fixed window, sliding window, token bucket | Fixed window |
| **Key** | Per IP, per user, per API key | Per IP |
| **Scope** | Global, per route group, single route | Per route group (`/auth` vs `/tasks`) |
| **Store** | In-memory, Redis (multi-server) | In-memory |

**Production later:** Redis store + `trust proxy` behind hosting so real client IP is counted.

---

## Project structure

```
todo_api/
├── app.js              → server, middleware, 404, global error handler, syncIndexes
├── middleware/
│   ├── auth.js         → JWT protect
│   └── rateLimit.js    → apiLimiter + authLimiter
├── routes/
│   ├── v1.js           → mounts /tasks + /auth under /api/v1
│   ├── auth.js         → register, login
│   └── task.js         → CRUD + bulk
├── controllers/
│   ├── auth.js         → register (findOne + create), login
│   └── task.js         → task logic
├── models/
│   ├── user.js         → email unique, bcrypt pre-save
│   └── task.js         → schema + enums
└── .env                → DB_CONNECTION, PORT, JWT, rate limits
```

---

## Setup

1. Install dependencies: `npm install`
2. Start MongoDB locally
3. Set `.env`:
   ```
   DB_CONNECTION=mongodb://localhost:27017/todo-app
   PORT=3005
   ```
4. Run: `npm run start`
5. Test with Postman (use **raw JSON** for POST/PATCH)

---

## Database

| | Name |
|---|------|
| Database | `todo-app` |
| Collections | `users`, `tasks` |
| Indexes | `users.email` unique (via `User.syncIndexes()` on startup) |

---

## Backend learning path (breadth-first)

Learn **one topic at a time** — touch each lightly, then go deeper when you implement it.

Inspired by: [10 Backend Concepts Every Node.js Developer Should Know](https://www.linkedin.com/pulse/10-backend-concepts-every-nodejs-developer-should-know-alom-chpjc/)

---

### 1️⃣ API design & REST

| Topic | One line | Status |
|-------|----------|--------|
| HTTP methods | GET read, POST create, PATCH update, DELETE remove | ✅ |
| Clean URLs | `/tasks/:id` not `/getTask/:id` | ✅ |
| Status codes | 200, 201, 400, 401, 404, 409, 429, 500 — mapped in global handler | ✅ steps 1–3 |
| **API versioning** | `/api/v1/tasks` so you can change v2 without breaking clients | ✅ `routes/v1.js` + one prefix in `app.js` |
| Pagination | `?page=1&limit=10` — `{ data, page, limit, total, totalPages }`, max 100 | ✅ |
| **REST vs WebSocket vs gRPC** | HTTP JSON vs live channel vs service-to-service RPC | ❌ concept — see [WebSocket & gRPC](#websocket--grpc-vs-rest) |

---

### 2️⃣ Authentication vs Authorization

| Topic | One line | Status |
|-------|----------|--------|
| **Authentication** | *Who are you?* — login, verify identity | ✅ |
| **Authorization** | *What can you do?* — permissions, roles (user vs admin) | 💡 ownership done, roles pending |
| **JWT** | Token sent in header `Authorization: Bearer <token>` — stateless login | ✅ |
| **Sessions / cookies** | Server stores login state — alternative to JWT | ❌ |
| **Protect routes** | Middleware blocks `/tasks` if not logged in | ✅ |
| **User owns tasks** | Each task linked to `userId` — users see only their data | ✅ |

**Ownership id flow** (detail in [`learn.md` §8b2](learn.md#8b2-task-ownership--where-userid-comes-from)):

| Step | What | Field |
|------|------|-------|
| Register | MongoDB creates User | `_id` |
| Login | Embed in JWT | payload `userId` |
| `/tasks` + `protect` | Same token → `req.user` | `req.user._id` |
| Create task | Save on task | Task `userId` |
| Get / update / delete | Filter by owner | `{ userId: req.user._id }` |

---

### 3️⃣ Security fundamentals

| Topic | One line | Status |
|-------|----------|--------|
| **Environment secrets** | `.env` for DB URL, JWT secret — never commit to git | ✅ |
| **Helmet** | Safe HTTP headers (XSS, clickjacking protection) | ✅ — see [`learn.md` §10b](learn.md#10b-safe-http-headers--what-helmet-actually-does) |
| **CORS** | Which frontends may call your API — whitelist by env | ✅ |
| **Rate limiting** | Max requests per IP/time — stops abuse & DDoS | ✅ `express-rate-limit` — see [Rate limiting](#rate-limiting) |
| **Input validation** | Reject bad data before DB — hand-rolled rules shared by create / update / bulk | ✅ |
| **NoSQL injection** | Don't pass raw user input into queries | 💡 OK with Mongoose |
| **HTTPS** | Encrypt traffic — required in production | ❌ on deploy |
| **Password hashing** | Never store plain passwords (`bcrypt`) | ✅ |

---

### 4️⃣ Error handling & logging

| Topic | One line | Status |
|-------|----------|--------|
| **404 handler** | Unknown URL → JSON, not HTML | ✅ |
| **Global error handler** | One `app.use(err, req, res, next)` for all crashes | ✅ |
| **`next(err)` in controllers** | Pass errors up instead of duplicate responses | ✅ |
| **Structured logging** | Log requests + errors | ✅ `morgan` requests + `pino` JSON app logs, both stamped with `requestId` / `userId` |
| **Health check** | `GET /health` — is server alive? | ✅ 200 / 503 on DB state |
| **Meaningful error messages** | Exact status + message per failure type | ✅ steps 1–3 — see [API error handling](#api-error-handling) |
| **Handle API failure (client + server)** | Timeouts, retry, idempotency, circuit breaker | 💡 partial — ✅ outbound timeouts + retry with jitter; ❌ idempotency, circuit breaker |

---

### 5️⃣ Database & performance

| Topic | One line | Status |
|-------|----------|--------|
| **MongoDB local** | `mongodb://localhost:27017/todo-app` | ✅ |
| **MongoDB Atlas** | Cloud DB — only change `.env` connection string | ❌ |
| **Indexes** | Speed up filter/search on large collections | ❌ |
| **Query optimization** | Fetch only fields you need, avoid slow regex at scale | 💡 |
| **Timestamps** | Auto `createdAt` / `updatedAt` via `{ timestamps: true }` | ✅ |
| **ACID transactions** | Multi-step writes all succeed or all roll back | ❌ concept — see [ACID transactions](#acid-transactions) |

---

### 6️⃣ Caching

| Topic | One line | Status |
|-------|----------|--------|
| **Why cache** | Store frequent reads in memory — less DB load | ❌ |
| **In-memory cache** | Simple start (`node-cache`) — good for learning | ❌ |
| **Redis** | Shared cache across multiple servers — production choice | ❌ |
| **Cache invalidation** | Clear cache when task is created/updated/deleted | ❌ |
| **What not to cache** | User-specific or rapidly changing data — cache carefully | ❌ |

---

### 7️⃣ Scalability & load handling

| Topic | One line | Status |
|-------|----------|--------|
| **Event loop** | Node is non-blocking — understand async/await | 💡 using it |
| **Stateless API** | No session data in server memory — scales horizontally | ❌ |
| **Load balancing** | Spread traffic across multiple servers (nginx, cloud LB) | ❌ infra |
| **Horizontal scaling** | More servers, not bigger server | ❌ infra |
| **Background jobs** | Heavy work off the request (email, exports) — queues later | ❌ |
| **Concurrent connections** | Many clients at once on one Node process — event loop, pools | ❌ concept — see [Advanced concepts](#advanced-concepts-learn-breadth--force-in-when-ready) |

> Load balancing & multiple servers are **infrastructure** — you learn the concept first; setup comes at deploy time.

---

## Advanced concepts (learn breadth — force in when ready)

Topics you asked to track **even if the Todo API doesn't need them yet**. Learn the theory now; **force a small experiment into the app later** so the idea sticks.

| Topic | Needed for Todo MVP? | Force-in idea (when ready) |
|-------|----------------------|----------------------------|
| [Concurrent connections](#concurrent-connections) | 💡 implicit | Load-test `GET /tasks`, watch Mongo pool |
| [WebSocket & gRPC](#websocket--grpc-vs-rest) | ❌ | Live task updates via WebSocket demo |
| [Handle API failure](#handling-api-failure) | 💡 partial | Client retry + idempotent bulk create |
| [ACID transactions](#acid-transactions) | ❌ | Register user + seed welcome task atomically |
| [Gateways (glossary)](#gateways-common-terms) | ❌ | Call Stripe/Razorpay later; API Gateway only at microservices scale |

---

### Concurrent connections

**What it is:** How many **clients can talk to your server at the same time** without each one blocking the others.

**Classic model (e.g. old Apache, Java thread-per-request):**
```
Request 1 → Thread 1 (blocked until DB responds)
Request 2 → Thread 2
Request 3 → Thread 3
… 500 threads = heavy memory
```

**Node.js model (what you use):**
```
One main thread + event loop
Request 1 → start async DB call → don't wait, handle Request 2
DB returns  → finish Request 1 response
```

Node is **single-threaded for JavaScript** but **non-blocking** — it handles **many concurrent connections** as long as work is async (MongoDB queries, `await`, etc.).

| Term | Meaning |
|------|---------|
| **Concurrent** | Many requests *in flight* at the same time |
| **Parallel** | Actually running on multiple CPU cores at once (Worker threads, cluster, multiple servers) |
| **Connection pool** | MongoDB driver keeps a pool of open DB connections — reuse instead of connect per query |
| **Backpressure** | When overload hits, slow or reject clients (rate limiting, 503, queue) — you started this with `429` |

**When it bites you:**
- Slow regex on huge `tasks` collection → one request holds the event loop too long → others lag
- No pool limits → too many DB connections under load
- CPU-heavy sync code (`JSON.parse` on 50MB body) → blocks everyone

**Force into Todo API (learning):**
1. Run 50 parallel `GET /tasks` in Postman Collection Runner or `ab` / `k6` — watch response times.
2. Log `mongoose.connection.readyState` and pool size under load.
3. Later: `cluster` module or PM2 multi-instance on deploy.

**One line:** Concurrent connections = many users hitting your API at once; Node handles them with async I/O, not one thread per user.

---

### WebSocket & gRPC (vs REST)

Your Todo API today is **REST over HTTP/JSON** — request → response, connection closes. Two other common styles:

#### Comparison

| | **REST (you have)** | **WebSocket** | **gRPC** |
|---|---------------------|---------------|----------|
| **Transport** | HTTP | HTTP upgrade → persistent TCP | HTTP/2 (often) |
| **Style** | Request / response | **Bidirectional**, long-lived | Request / response (+ streams) |
| **Format** | JSON (text) | JSON or binary frames | **Protocol Buffers** (binary) |
| **Best for** | CRUD APIs, public HTTP | Chat, live dashboards, notifications | **Service-to-service**, microservices |
| **Browser** | Native `fetch` | Native `WebSocket` API | Needs grpc-web proxy |
| **Node package** | Express | `ws`, `socket.io` | `@grpc/grpc-js` |

#### WebSocket — when & why

```
Client                    Server
   │──── HTTP handshake ────►│
   │◄─── upgrade to WS ──────│
   │════ open connection ════│  stays open
   │◄── task updated ────────│  server pushes anytime
   │──── mark complete ─────►│  client sends anytime
```

**Todo API use case (force in):**
- User A creates a task → **push** to same user's open tabs without polling `GET /tasks` every 5s
- "Someone assigned you a task" notifications (future multi-user)

**Not a replacement for REST** — keep REST for CRUD; add WebSocket for **real-time** events.

#### gRPC — when & why

- Strongly typed `.proto` contracts (like TypeScript interfaces for the wire)
- Faster, smaller payloads than JSON
- Used **backend ↔ backend** (Order service calls User service), not usually browser-first

**Todo API use case (force in):**
- Split into `auth-service` + `task-service` — they talk via gRPC internally while the browser still uses REST
- Overkill for one monolith — good **learning exercise** in a separate branch

**One line:** REST = your HTTP JSON API; WebSocket = live two-way channel; gRPC = fast typed calls between services.

---

### Handling API failure

Failure happens at **three layers** — know all three:

```
Browser/App          Network              Your API              Database
    │                    │                    │                     │
    │── fetch /tasks ───►│── timeout? ───────►│── query fails ─────►│
    │◄── 500 / no net ───│◄── 429 rate limit ──│◄── connection lost ─│
```

#### Server-side (your job now — ties to [status codes fix](#api-error-handling))

| Practice | What | Status in Todo API |
|----------|------|-------------------|
| **Correct status codes** | 4xx vs 5xx — client vs server fault | ✅ steps 1–3 done |
| **Consistent error JSON** | Same shape every failure | ❌ `AppError` goal |
| **Don't leak internals** | Hide stack traces in production | ❌ |
| **Global error handler** | One place for crashes | ✅ |
| **Graceful shutdown** | Finish in-flight requests before kill | ❌ deploy topic |
| **Health check** | `GET /health` for load balancer | ✅ |
| **Idempotency** | Same request twice = safe (e.g. duplicate POST) | ❌ |

#### Client-side (your Next.js app later)

| Practice | What |
|----------|------|
| **Timeouts** | Don't wait forever — `AbortController` after 10s |
| **Retry with backoff** | 429 / 503 → wait 1s, 2s, 4s, retry (not on 400/401) |
| **Show user-friendly errors** | Map status → "Session expired", "Too many tries" |
| **Offline / network error** | `fetch` throws — catch separately from 4xx/5xx |
| **Circuit breaker** | After N failures, stop calling API for a while |

#### Decision: should the client retry?

| Status | Retry? | Why |
|--------|--------|-----|
| `400`, `401`, `404` | ❌ | Client must fix input or login |
| `409` | ❌ | Conflict — need different action |
| `429` | ✅ after delay | Read `RateLimit-Reset` header |
| `500`, `503` | ✅ limited retries | Maybe transient |
| Network error | ✅ limited retries | Cable blip |

**Force into Todo API (learning):**
1. ~~Finish status-code fixes (steps 1–3)~~ ✅ done
2. Add `POST /tasks/bulk` **idempotency key** header — duplicate key returns same result, not double insert
3. In frontend: central `apiClient` with timeout + retry on 429/500

**One line:** Handle failure on both sides — server returns honest status + message; client timeouts, retries wisely, and shows clear UI.

---

### ACID transactions

**ACID** = four guarantees when **multiple database steps must succeed or fail together**.

| Letter | Meaning | Plain English |
|--------|---------|---------------|
| **A** — Atomicity | All steps or none | Transfer money: debit + credit both happen, or neither |
| **C** — Consistency | DB rules always hold | Unique email still unique after the operation |
| **I** — Isolation | Concurrent ops don't corrupt each other | Two registers same email — one wins cleanly |
| **D** — Durability | Committed data survives crash | After `201`, power loss doesn't erase the row |

#### SQL vs MongoDB

| | **PostgreSQL / MySQL** | **MongoDB (Mongoose)** |
|---|------------------------|-------------------------|
| Transactions | Built-in, multi-table | **Multi-document transactions** (replica set / Atlas) |
| Typical unit | `BEGIN … COMMIT` | `session.startTransaction()` |
| Your Todo API | N/A today | Single-doc updates don't need a transaction |

**When single-document is enough (no transaction):**
- `PATCH /tasks/:id` — one document update ✅

**When you need a transaction (multi-step):**
- Register user **and** create 3 default tasks — if tasks fail, roll back user
- Move task to another user: update `userId` **and** write audit log document
- Bulk bank-style: deduct credits **and** create task — both or neither

#### MongoDB transaction sketch (future)

```js
const session = await mongoose.startSession();
session.startTransaction();
try {
  await User.create([{ email, password }], { session });
  await Task.insertMany(defaultTasks, { session });
  await session.commitTransaction();
} catch (e) {
  await session.abortTransaction();
  throw e;
} finally {
  session.endSession();
}
```

**Trade-offs:**
- Slower than single writes
- Requires replica set (Atlas qualifies; local MongoDB needs `--replSet`)
- Overkill for simple CRUD — use when **business rule spans multiple documents**

**Force into Todo API (learning):**
- `POST /auth/register` → atomically create user + welcome task `"Getting started"`
- If task insert fails, user row is rolled back — no orphan accounts

**One line:** Transactions = all-or-nothing multi-step DB work; learn on register+seed task, skip for simple single-task PATCH.

---

### Gateways (common terms)

A **gateway** is a **middle door**: traffic or data goes through it before reaching the real system. Same word, different jobs — don't mix them up.

#### Core idea

```
Client / app  →  Gateway  →  Real service (your API, bank, SMS provider, …)
```

The gateway **translates, secures, routes, or hides complexity** so callers don't talk to every backend directly.

#### Common gateway types (backend / cloud)

| Term | What it does | Examples | Todo API? |
|------|--------------|----------|-----------|
| **API Gateway** | Single entry for many services — auth, rate limit, routing, versioning | Kong, AWS API Gateway, nginx, Azure APIM | ❌ overkill (one Express app) |
| **Payment Gateway** | Talks to banks/cards; you never store raw card data | Stripe, Razorpay, PayPal, Braintree | ❌ unless you add paid plans |
| **SMS Gateway** | Sends/receives text messages via telecom | Twilio, MSG91, Vonage | ❌ optional 2FA later |
| **Email Gateway / ESP** | Delivers email at scale (not always called “gateway”) | SendGrid, SES, Mailgun, Resend | ❌ welcome emails later |
| **Push / notification gateway** | Routes push to FCM / APNs | Firebase, OneSignal | ❌ mobile later |
| **IoT Gateway** | Bridge between devices (MQTT/Zigbee) and cloud APIs | AWS IoT, Azure IoT Hub | ❌ not this project |
| **Media / VoIP Gateway** | Voice/video protocol conversion | Twilio Voice, Asterisk | ❌ |
| **NAT Gateway** | Private servers reach the internet with a public IP | AWS NAT Gateway | ❌ cloud networking |
| **Internet Gateway** | VPC ↔ public internet | AWS Internet Gateway | ❌ cloud networking |
| **Application Gateway** | L7 load balance + WAF (Azure name) | Azure Application Gateway | ❌ infra |
| **Storage Gateway** | On-prem storage ↔ cloud buckets | AWS Storage Gateway | ❌ |
| **Webhook Gateway** | Receives/verifies vendor callbacks in one place | Svix, custom proxy | ❌ if many webhooks |

#### Related words (not always “gateway”, same neighborhood)

| Term | How it differs |
|------|----------------|
| **Reverse proxy** | Forwards HTTP to your app (nginx, Caddy) — often *part of* an API Gateway |
| **Load balancer** | Spreads traffic across many servers — may sit in front of or inside a gateway |
| **BFF (Backend for Frontend)** | One API shaped for one UI (Next.js) — like a small app-specific gateway |
| **Service mesh** | Sidecars between microservices (Istio, Linkerd) — east-west traffic, not the public front door |
| **Adapter / SDK** | Your code calls Stripe's library — *you* are the client; Stripe *is* the payment gateway |

#### API Gateway vs Payment Gateway (don't confuse)

| | **API Gateway** | **Payment Gateway** |
|---|-----------------|---------------------|
| Job | Route/secure **your** APIs | Process **money** |
| You build? | Rarely yourself at start — use Kong/cloud | Almost never yourself — use Stripe/Razorpay |
| Touches Todo API? | Only if you split into many microservices | Only if you charge users |

```
Browser → API Gateway → Task service, Auth service, …
App     → Payment Gateway → Bank / card network
```

#### Force into Todo API (learning, later)

1. **Payment:** Stripe Checkout for a “Pro todos” plan — never store card numbers.
2. **Email/SMS:** send “task due” via Resend or Twilio (background job + queue).
3. **API Gateway:** skip until you have **multiple** services; Express + rate limit + auth is enough for one app.

**One line:** Gateway = front door to something hard (APIs, payments, SMS); learn the names now, add Stripe/email when a feature needs it — not for basic CRUD.

---

## API performance & monitoring

One place for **speed** (respond fast) and **observability** (know what broke in production). Topics below map to [`learn.md` §15](learn.md#15-api-performance--observability--the-vocabulary-and-the-loop). Implement remaining items in [`todo.md`](todo.md) after auth and structured errors.

**Logging is observability** — it is one of the three pillars (logs, metrics, traces), not the whole discipline. Health checks, error tracking, and alerting sit under the same umbrella.

### Observability — implemented vs remaining

| Piece | What it answers | Status | Where |
|-------|-----------------|--------|-------|
| **Request logging** (logs pillar) | What happened to *this* request? | ✅ | `morgan` in `app.js` — stdout always; `logs/access.log` in dev only. [`learn.md` §12](learn.md#12-request-logging-morgan--health-check) |
| **Correlation / request id** | Which of 500 concurrent users? | ✅ | `utils/requestContext.js` — ALS + `X-Request-Id`; `userId` after JWT; error logs + morgan `:id` |
| **Health / readiness** | Is this instance fit for traffic? | ✅ | `GET /health` — 200 / 503 from `mongoose.connection.readyState` |
| **Error log on unknown 500s** | What was the stack? | ✅ | `logger.error({ err })` in the global handler — stamped with `requestId`; not yet grouped or alerted |
| **Structured logs** | Searchable JSON with levels | ✅ | `pino` in `utils/logger.js` — `mixin` adds `requestId` / `userId` to every line |
| **Metrics** (metrics pillar) | Is `GET /tasks` slower this week? | ❌ | `prom-client` + `GET /metrics` (p50 / p95 / p99). Duration in morgan is per-request, not an aggregate |
| **Traces** (traces pillar) | Of 800 ms, how much was auth vs Mongo? | ❌ | OpenTelemetry / APM product |
| **Error tracking** | Group crashes, notify | ❌ | Sentry (or similar) |
| **Alerting** | Page a human when an SLI breaks | ❌ | Hosting dashboard or APM — this is **monitoring**, which uses the data above |
| **Profiling** | Event-loop lag, heap, CPU | ❌ | After you have real traffic; related to [`learn.md` §19](learn.md#19-how-node-serves-many-users--one-thread-cluster-worker-threads) |
| **Uptime checks** | Probe `/health` from outside | ❌ | After deploy |

**Done in this Todo API:**

1. ✅ **`morgan`** — `dev` locally, `combined` in production, both to stdout. Extra `combined` file only when not production. Both formats start with `:id :user`.
2. ✅ **`GET /health`** — skipped by morgan so probes do not bury real traffic.
3. ✅ **`pino`** (`utils/logger.js`) — JSON logs with levels; a `mixin` reads the request store so **every** line carries `requestId` + `userId`. `pino-pretty` locally, raw JSON to stdout in production.
4. ✅ **Correlation id** (`utils/requestContext.js`) — `AsyncLocalStorage` + `X-Request-Id`. See [`learn.md` §12b](learn.md#12b-correlation-id--asynclocalstorage-which-user-was-that).
5. ✅ **Unhandled errors** logged with the stack via `logger.error`; client still sees a generic 500 in production.

**Still to add (learning order):**

1. **`prom-client` + `GET /metrics`** — sit outside `/api/v1`, not public in production. See [`learn.md` §15](learn.md#15-api-performance--observability--the-vocabulary-and-the-loop).
2. **Sentry** (or similar) — grouping and alerting on top of the pino stream once deployed.
3. **Alerting** — error rate or p95 latency, on the hosting dashboard or APM.
4. **Tracing** — when more than one service exists; not needed for a single Express process yet.
5. **`pino-http`** — optional: replaces morgan so the access line is JSON too, rather than text.

### Performance (make the API faster)

| Topic | What it does | Status | Where to learn |
|-------|--------------|--------|----------------|
| **Pagination** | `?page=&limit=` — `{ data, page, limit, total, totalPages }`, default 10, max 100 | ✅ | `controllers/task.js` `getTasks` |
| **MongoDB indexes** | Index `userId`, `status`, `createdAt` — filters stay fast as data grows | ❌ | [§5 Database & performance](#5️⃣-database--performance) |
| **Query optimization** | `.select()`, avoid unindexed regex on huge collections | 💡 | [§5](#5️⃣-database--performance) |
| **Response compression** | `compression` middleware — smaller JSON over the wire | ❌ | Deploy / hardening |
| **Caching** | Cache hot reads (Redis in prod); invalidate on write | ❌ | [§6 Caching](#6️⃣-caching) |
| **Rate limiting** | Protect DB + auth from abuse | ✅ | [Rate limiting](#rate-limiting) |

**Order to add in this project:** indexes on `tasks` → optional cache for `GET /tasks` → compression at deploy.

Performance and observability are related but not the same list. Indexes make the API faster. Metrics *tell you* it got faster.

---

### 8️⃣ Environment & secrets

| Topic | One line | Status |
|-------|----------|--------|
| **dotenv** | Load secrets from `.env` file | ✅ |
| **`.env.example`** | Template without real secrets — safe to commit | ✅ |
| **`.gitignore`** | Block `.env` from git | ✅ |
| **Multiple environments** | dev / staging / prod with different `.env` values | 💡 `NODE_ENV` + CORS vars |

---

### 9️⃣ Testing & maintainability

| Topic | One line | Status |
|-------|----------|--------|
| **API tests** | Test routes with Supertest (`GET /tasks` returns 200) | ❌ |
| **Unit tests** | Test one function in isolation | ❌ |
| **Integration tests** | Test API + DB together | ❌ |
| **Controllers folder** | Separate routes from logic — easier to test | ✅ |

---

### 🔟 DevOps & deploy

| Topic | One line | Status |
|-------|----------|--------|
| **Deploy** | Host online (Render, Railway, Fly.io) | ❌ |
| **Process manager** | Keep Node running (`pm2`) | ❌ |
| **CI/CD** | Auto test + deploy on git push | ❌ |
| **API docs** | Swagger or Postman collection | ❌ |

---

## Skill snapshot & gaps (honest)

**This project (concepts you built):** ~7.5 / 10 — you understand the flow and the *why*, not just copy-paste.

**Node.js backend (market / production readiness):** ~5.5 / 10 — solid foundation; still early on ops, tests, and hardening.

**Frontend helps:** HTTP, headers, CORS, async, JWT from client side — you're learning backend faster than a cold start.

### Gaps — why they matter

| Gap | Why it matters |
|-----|----------------|
| **No tests (Supertest)** | Can't prove behavior or refactor safely — one change can break auth or ownership silently |
| **No deploy / Atlas / CI/CD** | App only runs on your machine — no real users, no HTTPS, no pipeline |
| **No `AppError`** | Task write routes return `{ message, errors[] }`; everything else is still `{ message }` only — no single error class or shape |
| **No MongoDB indexes on tasks** | Slow queries as data grows — filter/search on large `tasks` collection lags |
| **No structured (JSON) logs** | `morgan` gives a request trail, but plain text — `winston`/`pino` levels + JSON still pending for searchable production logs |
| **No pagination / caching** | Pagination is in; no cache yet — repeats of the same `GET /tasks` still hit Mongo every time |
| **Role auth not implemented** | `role` field exists but unused — admin vs user authorization missing |
| **Malformed JSON / prod 500 hiding** | Bad JSON body and internal error detail hiding still pending |

Work through these via [`todo.md`](todo.md) — backend breadth first, then hosting & CI/CD, frontend last.

### Rating path (Node.js backend)

| Stage | Rating | Status |
|-------|--------|--------|
| Tutorial clone | 3–4 | ✅ Past this |
| Working API + auth + ownership + core errors | 5–6 | ✅ **You are here** |
| Tests + deploy + AppError / validation lib | 6.5–7 | Next stretch |
| Production hardening + CI/CD | 7.5–8 | After `todo.md` Phase 2–3 |
| Senior backend Node | 8+ | Multiple systems / years |

---

## Suggested order (do one at a time)

| Step | Topic | Why this order |
|------|-------|----------------|
| 1 | ✅ CRUD + filters + errors | Foundation — **done** |
| 2 | ✅ `.gitignore` + `.env.example` | Secrets safety — **done** |
| 3 | ✅ Auth (JWT) + task ownership | Users + own tasks — **done** |
| 4 | ✅ Status codes steps 1–3 — **`AppError` + error JSON shape** next | Client knows what failed |
| 5 | ✅ Input validation — hand-rolled, shared across write routes | Safer API before more features — **done** |
| 6 | ✅ Rate limiting + ✅ Helmet | Basic security layer — **done** |
| 7 | ✅ Logging + health check — see [`learn.md` §12](learn.md#12-request-logging-morgan--health-check) | Debug production issues — **done** |
| 8 | ✅ API versioning `/api/v1` | Clean future changes — **done** |
| 9 | Tests (Supertest) | Confidence before deploy |
| 10 | Atlas + deploy + HTTPS + CI/CD | Go live |

---

## Todo API features still pending

See the grouped list under [❌ Pending](#-pending) at the top of this file.

---

## Miscellaneous tasks

*(Learning-driven — not required by the app, done to understand what a library does for you)*

### ❌ Build my own rate limiter

Replace `express-rate-limit` on `/tasks` with a hand-rolled version. Keep the library on `/auth` while learning, so a bug in my own middleware can't lock me out of login.

**The easy part:** `req.ip` plus a `Map` of `key → { count, resetAt }` — a fixed-window limiter is ~20 lines.

**The parts that are actually hard:**

| Problem | Why it bites |
|---------|--------------|
| **Map grows forever** | Every IP stays in memory until restart — needs an expiry sweep, and the interval must be `unref()`'d so it doesn't keep Node alive |
| **Per-process counters** | Two instances (PM2 cluster / 2 dynos) = two separate counts = double the real limit. Shared store (Redis) is the hard part, not the algorithm |
| **`req.ip` behind a proxy** | On Render / Railway every request looks like it comes from the load balancer → one shared bucket for all users. Needs `app.set('trust proxy', n)` |
| **Trusting `X-Forwarded-For`** | Trust it blindly and a client forges it for a fresh quota per fake IP — trust exactly as many hops as the infra has |
| **IP ≠ user** | Office / university NAT shares one IP across hundreds of people; mobile IPs rotate |
| **Fixed window bursts** | 10/15min allows 10 at 14:59 + 10 at 15:01 = 20 in two minutes → sliding window or token bucket |

**Design decision:** key `/tasks` on `req.user._id` (routes are behind `protect`, so real per-user fairness, no NAT collateral); keep IP keying for `/auth`, where there is no user yet.

**Response details to match the library:** `429` JSON body, `Retry-After` header, and `RateLimit-*` standard headers.

See also: [Rate limiting](#rate-limiting) for the current library setup, `learn.md` for the Q&A.

---

## Related docs

| File | Topic |
|------|-------|
| `api-structure.md` | **API structure and features** — request-lifecycle diagram + built-vs-missing checklist per layer |
| `authflow.md` | JWT, sign, verify, token creation |
| `learn.md` | dotenv, cors, json, errors, routes, **headers**, **safe/security headers (Helmet)**, **rate limiting**, **task ownership / userId flow** |
| `mongoStructure.md` | Collections, documents, linking |
| `opensource.md` | **Commercial OSS Node projects** — Cal.com, PostHog, Vendure, YC, Google, study guide |
| `todo.md` | Full future work checklist |

---

> **How to use this readme:** pick **one row** from the learning path or pending list, say which topic you want, and we'll implement it together.
