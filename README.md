# Todo API

Simple Node.js + Express + MongoDB todo backend.

**Run:** `npm run start`  
**Base URL:** `http://localhost:3005`

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
- ✅ Create task — `POST /tasks`
- ✅ Get all tasks — `GET /tasks`
- ✅ Get one task — `GET /tasks/:id`
- ✅ Update task — `PATCH /tasks/:id`
- ✅ Delete one task — `DELETE /tasks/:id`
- ✅ Delete many tasks — `DELETE /tasks/bulk`
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
- ✅ Bulk create — `POST /tasks/bulk`
- ✅ `.gitignore` + `.env.example`
- ✅ Unique email on user
- ✅ Rate limiting — `express-rate-limit` on `/tasks` and `/auth` (see [Rate limiting](#rate-limiting))

---

## 💡 In progress

- 💡 Auto-update `updatedAt` on PATCH
- 💡 Stronger input validation (beyond Mongoose defaults)
- 💡 Date filters (`?dueBefore=`, overdue tasks)
- 💡 **Exact, consistent API errors** — see [API error handling](#api-error-handling) below

---

## ❌ Pending

- ❌ Pagination — `?page=1&limit=10`
- ❌ Mark complete shortcut — `PATCH /tasks/:id/complete`
- ❌ Frontend (React / Next.js — last)
- ❌ File uploads for attachments
- ❌ Richer schema (subTasks, comments as objects)
- ❌ Tests (Jest / Supertest)
- ❌ Deploy (Render, Railway, etc.)

### Error handling (goal: exact errors on every failure)

- ❌ `AppError` class — `throw new AppError('Task not found', 404)` + one handler
- ❌ Consistent error JSON shape — `{ success, status, message, errors[] }`
- ❌ Field-level validation errors — `{ field: "title", message: "required" }`
- ❌ `409 Conflict` for duplicate email (today: `400`)
- ❌ `403 Forbidden` for role-based routes (admin vs user)
- ❌ Invalid MongoDB id format → `400` not `500`
- ❌ Malformed JSON body → clear `400` message
- ❌ Production: hide internal `500` details from client (log server-side only)
- ❌ Map all Mongoose `ValidationError` → readable `400` messages

---

## API quick reference

| Method | URL | Action |
|--------|-----|--------|
| GET | `/tasks` | Get all (filter, search, sort) |
| GET | `/tasks/:id` | Get one |
| POST | `/tasks` | Create |
| PATCH | `/tasks/:id` | Update |
| DELETE | `/tasks/:id` | Delete one |
| DELETE | `/tasks/bulk` | Delete many |

### Examples

```
GET  /tasks?status=pending&priority=high&sort=-dueDate
GET  /tasks?search=meeting&tag=work
POST /tasks          (JSON body)
PATCH /tasks/:id     (JSON body)
DELETE /tasks/bulk   { "ids": ["id1", "id2"] }
```

---

## HTTP headers (this project)

Headers are **metadata** sent with requests and responses — not in the URL or body.

### Headers you must send (client → API)

| Header | When required | Value | Example route |
|--------|---------------|-------|---------------|
| **`Content-Type`** | POST / PATCH with JSON body | `application/json` | `POST /tasks`, `POST /auth/register`, `PATCH /tasks/:id` |
| **`Authorization`** | All `/tasks` routes | `Bearer <token>` | `GET /tasks`, `POST /tasks`, etc. |

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
| Security headers (`Helmet`) | `X-Content-Type-Options`, etc. | ❌ see `todo.md` |
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
 Global error handler               → ValidationError → 400, else → 500
```

| Layer | Handles |
|-------|---------|
| **Middleware** | Rate limit (`429`), auth (`401`), CORS (browser block) |
| **Controller** | Expected errors — bad body (`400`), not found (`404`) |
| **404 handler** | Route doesn't exist |
| **Error handler** | Thrown errors via `next(err)` |

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
├── app.js              → server, middleware, 404, errors
├── middleware/
│   ├── auth.js         → JWT protect
│   └── rateLimit.js    → apiLimiter + authLimiter
├── routes/task.js      → URLs
├── controllers/task.js → logic
├── models/task.js      → schema
└── .env                → DB_CONNECTION, PORT
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
| Collection | `tasks` |

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
| Status codes | 200 OK, 201 created, 400 bad input, 404 not found, 500 server error | 💡 |
| **API versioning** | `/api/v1/tasks` so you can change v2 without breaking clients | ❌ |
| Pagination | `?page=1&limit=10` — don't return everything at once | ❌ |

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

---

### 3️⃣ Security fundamentals

| Topic | One line | Status |
|-------|----------|--------|
| **Environment secrets** | `.env` for DB URL, JWT secret — never commit to git | ✅ |
| **Helmet** | Safe HTTP headers (XSS, clickjacking protection) | ❌ |
| **CORS** | Which frontends may call your API — whitelist by env | ✅ |
| **Rate limiting** | Max requests per IP/time — stops abuse & DDoS | ✅ `express-rate-limit` — see [Rate limiting](#rate-limiting) |
| **Input validation** | Reject bad data before DB (`express-validator`) | 💡 Mongoose only |
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
| **Structured logging** | Log requests + errors (`morgan`, `winston`) | ❌ |
| **Health check** | `GET /health` — is server alive? | ❌ |
| **Meaningful error messages** | Exact status + message per failure type — see [API error handling](#api-error-handling) | 💡 |

---

### 5️⃣ Database & performance

| Topic | One line | Status |
|-------|----------|--------|
| **MongoDB local** | `mongodb://localhost:27017/todo-app` | ✅ |
| **MongoDB Atlas** | Cloud DB — only change `.env` connection string | ❌ |
| **Indexes** | Speed up filter/search on large collections | ❌ |
| **Query optimization** | Fetch only fields you need, avoid slow regex at scale | 💡 |
| **Timestamps** | Auto `updatedAt` on every edit | 💡 |

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

> Load balancing & multiple servers are **infrastructure** — you learn the concept first; setup comes at deploy time.

---

## API performance & monitoring

One place for **speed** (respond fast) and **observability** (know what broke in production). Topics below map to sections 4–7 in the learning path; implement in [`todo.md`](todo.md) after auth and structured errors.

### Performance (make the API faster)

| Topic | What it does | Status | Where to learn |
|-------|--------------|--------|----------------|
| **Pagination** | `?page=1&limit=20` — don't return 10k tasks at once | ❌ | Step 10 in [Suggested order](#suggested-order-do-one-at-a-time) |
| **MongoDB indexes** | Index `userId`, `status`, `createdAt` — filters stay fast as data grows | ❌ | [§5 Database & performance](#5️⃣-database--performance) |
| **Query optimization** | `.select()`, avoid unindexed regex on huge collections | 💡 | [§5](#5️⃣-database--performance) |
| **Response compression** | `compression` middleware — smaller JSON over the wire | ❌ | Deploy / hardening |
| **Caching** | Cache hot reads (Redis in prod); invalidate on write | ❌ | [§6 Caching](#6️⃣-caching) |
| **Rate limiting** | Protect DB + auth from abuse | ✅ | [Rate limiting](#rate-limiting) |

**Order to add in this project:** pagination → indexes on `tasks` → optional cache for `GET /tasks` → compression at deploy.

### Monitoring (see what the API is doing)

| Topic | What it does | Status | Where to learn |
|-------|--------------|--------|----------------|
| **Request logging** | `morgan` — method, URL, status, response time in console | ❌ | [§4 Error handling & logging](#4️⃣-error-handling--logging) |
| **Structured logs** | `winston` — JSON logs with levels (info, warn, error) for prod | ❌ | [§4](#4️⃣-error-handling--logging) |
| **Health check** | `GET /health` → `{ status: "ok", db: "connected" }` for load balancers | ❌ | [§4](#4️⃣-error-handling--logging) |
| **Error tracking** | Sentry / similar — capture stack traces from production | ❌ | After deploy |
| **APM / metrics** | Datadog, New Relic, Prometheus — latency, throughput, slow queries | ❌ | Production / team tooling |
| **Alerting** | Notify when error rate or latency spikes | ❌ | With hosting or APM |

**Minimal stack for this Todo API (learning):**

1. **`morgan('dev')`** in `app.js` — see every request while developing.
2. **`GET /health`** — ping DB with `mongoose.connection.readyState`.
3. **`winston`** (optional) — replace `console.log` in error handler before deploy.
4. **Hosting dashboard** (Render/Railway) — CPU, memory, restarts after you deploy.

**Not in scope yet:** full APM dashboards, distributed tracing, custom metrics — add when the API is live and you need to debug real traffic.

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
| **No `AppError` / validation library** | Errors still inconsistent — clients get vague 500s instead of exact 400/404/409 |
| **No Helmet** | Missing safe HTTP headers (XSS, clickjacking) — add before production |
| **No MongoDB indexes** | Slow queries as data grows — filter/search on large `tasks` collection lags |
| **No logging / health check** | Hard to debug production — no request trail or uptime probe for load balancers |
| **No pagination / caching** | `GET /tasks` gets slower and heavier as every user's tasks accumulate |
| **Role auth not implemented** | `role` field exists but unused — admin vs user authorization missing |
| **Async / edge cases** | Invalid ObjectId, unhandled promise rejections — real traffic exposes crashes |

Work through these via [`todo.md`](todo.md) — backend breadth first, then hosting & CI/CD, frontend last.

### Rating path (Node.js backend)

| Stage | Rating | Status |
|-------|--------|--------|
| Tutorial clone | 3–4 | ✅ Past this |
| Working API + auth + ownership | 5–6 | ✅ **You are here** |
| Tests + deploy + structured errors | 6.5–7 | Next stretch |
| Production hardening + CI/CD | 7.5–8 | After `todo.md` Phase 2–3 |
| Senior backend Node | 8+ | Multiple systems / years |

---

## Suggested order (do one at a time)

| Step | Topic | Why this order |
|------|-------|----------------|
| 1 | ✅ CRUD + filters + errors | Foundation — **done** |
| 2 | ✅ `.gitignore` + `.env.example` | Secrets safety — **done** |
| 3 | ✅ Auth (JWT) + task ownership | Users + own tasks — **done** |
| 4 | **Exact API errors** (`AppError`, validation, status codes) | Client knows what failed |
| 5 | Input validation (`express-validator`) | Safer API |
| 6 | ✅ Rate limiting — **Helmet** next | Basic security layer |
| 7 | **Logging + health check** — see [API performance & monitoring](#api-performance--monitoring) | Debug production issues |
| 8 | API versioning `/api/v1` | Clean future changes |
| 9 | Tests (Supertest) | Confidence before deploy |
| 10 | Atlas + deploy + HTTPS + CI/CD | Go live |

---

## Todo API features still pending

*(Separate from backend concepts — add when ready)*

- ❌ Pagination
- ❌ Date filters / overdue
- ❌ Mark complete shortcut
- ❌ Frontend (Next.js — last)
- ❌ File uploads
- ❌ Richer schema (subTasks as objects)

---

## Related docs

| File | Topic |
|------|-------|
| `authflow.md` | JWT, sign, verify, token creation |
| `mongoStructure.md` | Collections, documents, linking |
| `learn.md` | dotenv, cors, json, errors, routes, **headers**, **rate limiting** Q&A |
| `todo.md` | Full future work checklist |

---

> **How to use this readme:** pick **one row** from the learning path or pending list, say which topic you want, and we'll implement it together.
