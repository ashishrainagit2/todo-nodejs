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
- ✅ CORS enabled
- ✅ PORT from `.env`
- ✅ Schema enum fix (`status`, `priority`)
- ✅ 404 handler (unknown routes)
- ✅ Global error handler

---

## 💡 In progress

- 💡 Auto-update `updatedAt` on PATCH
- 💡 Stronger input validation (beyond Mongoose defaults)
- 💡 Date filters (`?dueBefore=`, overdue tasks)
- 💡 README & API docs polish

---

## ❌ Pending

- ❌ Pagination — `?page=1&limit=10`
- ❌ Mark complete shortcut — `PATCH /tasks/:id/complete`
- ❌ Frontend (React / HTML UI)
- ❌ User auth (JWT / login)
- ❌ File uploads for attachments
- ❌ Richer schema (subTasks, comments as objects)
- ❌ Tests (Jest / Supertest)
- ❌ Deploy (Render, Railway, etc.)

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

## Project structure

```
todo_api/
├── app.js              → server, middleware, 404, errors
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
| **Authentication** | *Who are you?* — login, verify identity | ❌ |
| **Authorization** | *What can you do?* — permissions, roles (user vs admin) | ❌ |
| **JWT** | Token sent in header `Authorization: Bearer <token>` — stateless login | ❌ |
| **Sessions / cookies** | Server stores login state — alternative to JWT | ❌ |
| **Protect routes** | Middleware blocks `/tasks` if not logged in | ❌ |
| **User owns tasks** | Each task linked to `userId` — users see only their data | ❌ |

---

### 3️⃣ Security fundamentals

| Topic | One line | Status |
|-------|----------|--------|
| **Environment secrets** | `.env` for DB URL, JWT secret — never commit to git | 💡 add `.gitignore` |
| **Helmet** | Safe HTTP headers (XSS, clickjacking protection) | ❌ |
| **CORS** | Which frontends may call your API | ✅ basic |
| **Rate limiting** | Max requests per IP/time — stops abuse & DDoS | ❌ `express-rate-limit` |
| **Input validation** | Reject bad data before DB (`express-validator`) | 💡 Mongoose only |
| **NoSQL injection** | Don't pass raw user input into queries | 💡 OK with Mongoose |
| **HTTPS** | Encrypt traffic — required in production | ❌ on deploy |
| **Password hashing** | Never store plain passwords (`bcrypt`) | ❌ |

---

### 4️⃣ Error handling & logging

| Topic | One line | Status |
|-------|----------|--------|
| **404 handler** | Unknown URL → JSON, not HTML | ✅ |
| **Global error handler** | One `app.use(err, req, res, next)` for all crashes | ✅ |
| **`next(err)` in controllers** | Pass errors up instead of duplicate responses | ✅ |
| **Structured logging** | Log requests + errors (`morgan`, `winston`) | ❌ |
| **Health check** | `GET /health` — is server alive? | ❌ |
| **Meaningful error messages** | Tell client *what* went wrong, hide stack traces in prod | 💡 |

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

### 8️⃣ Environment & secrets

| Topic | One line | Status |
|-------|----------|--------|
| **dotenv** | Load secrets from `.env` file | ✅ |
| **`.env.example`** | Template without real secrets — safe to commit | ❌ |
| **`.gitignore`** | Block `.env` from git | ❌ |
| **Multiple environments** | dev / staging / prod with different `.env` values | ❌ |

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

## Suggested order (do one at a time)

| Step | Topic | Why this order |
|------|-------|----------------|
| 1 | ✅ CRUD + filters + errors | Foundation — **done** |
| 2 | `.gitignore` + `.env.example` | Secrets safety — quick win |
| 3 | Input validation | Safer API before auth |
| 4 | Rate limiting + Helmet | Basic security layer |
| 5 | Auth (JWT) + Authorization | Users + own tasks only |
| 6 | Logging + health check | Debug production issues |
| 7 | API versioning `/api/v1` | Clean future changes |
| 8 | Caching (in-memory → Redis) | Performance when needed |
| 9 | Tests (Supertest) | Confidence before deploy |
| 10 | Atlas + deploy + HTTPS | Go live |

---

## Todo API features still pending

*(Separate from backend concepts — add when ready)*

- ❌ Pagination
- ❌ Date filters / overdue
- ❌ Mark complete shortcut
- ❌ Frontend
- ❌ File uploads
- ❌ Richer schema (subTasks as objects)

---

> **How to use this readme:** pick **one row** from the learning path, say which topic you want, and we'll implement it together.


Glad it clicked — JWT auth is one of those topics that feels fuzzy until the signature + secret piece lands.

When you're ready, natural next steps for this project:

Finish login — password check + return token
Hash passwords on register
Point 4 — tie tasks to req.user._id so users only see their own tasks
Say which one you want to tackle next.
