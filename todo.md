# Todo — Future Work

Learning plan for this project: **touch every backend concept lightly first**, then **hosting**, then **CI/CD**. **Frontend last** — you already know that side better than backend and DevOps.

One topic at a time. Pick a row, implement, test in Postman, move on.

---

## Progress legend

| Icon | Meaning |
|------|---------|
| ✅ | Done |
| 💡 | In progress / partial |
| ❌ | Not started |

---

## Phase 1 — Backend (finish the breadth)

| # | Topic | One line | Status |
|---|-------|----------|--------|
| 1 | Task ownership (`userId`) | All CRUD scoped to `req.user._id` | ✅ |
| 2 | JWT auth | Register, login, `protect` middleware | ✅ |
| 3 | Password hashing | bcrypt pre-save + compare on login | ✅ |
| 4 | Unique email | `unique: true` on user email | ✅ |
| 5 | `.gitignore` + `.env.example` | Secrets safe, template for others | ✅ |
| 6 | Bulk create tasks | `POST /tasks/bulk` with userId | ✅ |
| 7 | Input validation | `express-validator` or Joi — reject bad body early | ❌ |
| 8 | Pagination | `?page=&limit=` on GET /tasks — `{ data, page, limit, total, totalPages }` | ✅ |
| 9 | Date filters | `?dueBefore=`, overdue tasks | ❌ |
| 10 | Auto `updatedAt` | Schema `{ timestamps: true }` + allowlisted PATCH | ✅ |
| 11 | Mark complete shortcut | `PATCH /tasks/:id/complete` | ❌ |
| 12 | Role authorization | Use `role` field — admin vs user middleware | ❌ |
| 13 | API versioning | `/api/v1/tasks` | ✅ |
| 14 | Helmet | Secure HTTP headers | ✅ |
| 15 | Rate limiting | `express-rate-limit` on auth + API | ✅ |
| 16 | Request logging | `morgan` — log method, URL, status | ✅ |
| 17 | Health check | `GET /health` — server + DB status | ✅ |
| 18 | Structured errors | Custom `AppError` class, consistent JSON | ✅ |
| 19 | MongoDB indexes | Index `userId`, `status`, `dueDate` on tasks | ❌ |
| 20 | In-memory cache | Cache GET /tasks, invalidate on write | ❌ |
| 21 | Redis cache | Shared cache — optional after in-memory | ❌ |
| 22 | File uploads | Attachments on tasks (`multer`) | ❌ |
| 23 | Richer schema | subTasks / comments as nested objects or new collections | ❌ |
| 24 | API tests | Supertest — auth + CRUD + ownership | ❌ |
| 25 | Swagger / OpenAPI | Auto API docs from routes | ❌ |
| 26 | Escape `?search` regex | `req.query.search` goes straight into `$regex` — metacharacters break or hijack the query | ❌ |

---

## Phase 2 — Hosting & database in the cloud

| # | Topic | One line | Status |
|---|-------|----------|--------|
| 26 | MongoDB Atlas | Cloud DB — update `DB_CONNECTION` in prod | ❌ |
| 27 | Deploy API | Render, Railway, or Fly.io | ❌ |
| 28 | HTTPS | Automatic on most hosts — understand why it matters | ❌ |
| 29 | Production env vars | Set secrets on host dashboard, not in code | ❌ |
| 30 | Process manager | `pm2` or host-managed restart | ❌ |
| 31 | Clean old data | Remove tasks without `userId` from early testing | ❌ |

---

## Phase 3 — CI/CD

| # | Topic | One line | Status |
|---|-------|----------|--------|
| 32 | GitHub Actions — test on push | Run `npm test` on every PR | ❌ |
| 33 | GitHub Actions — lint | Optional ESLint step | ❌ |
| 34 | Auto deploy | Push to `main` → deploy to host | ❌ |
| 35 | Branch protection | Require PR + passing checks before merge | ❌ |

---

## Phase 4 — Frontend (last)

| # | Topic | One line | Status |
|---|-------|----------|--------|
| 36 | React app | Separate project — login, task list, forms | ❌ |
| 37 | Token storage | localStorage or httpOnly cookie strategy | ❌ |
| 38 | Attach token to fetch | `Authorization: Bearer` on every API call | ❌ |
| 39 | Error + loading UI | Handle 401, 404, network errors | ❌ |

> Local `public/index.html` demo exists for testing only — gitignored until React replaces it.

---

## Suggested next 5 picks (backend first)

| Order | Pick | Why |
|-------|------|-----|
| 1 | ✅ Input validation (#7) | Safer API before more features |
| 2 | ✅ Helmet + rate limit (#14, #15) | Quick security wins |
| 3 | ✅ Health check + morgan (#16, #17) | Production debugging basics |
| 4 | ✅ Structured errors — `AppError` (#18) | One error shape across every route |
| 5 | ✅ API versioning (#13) + Swagger | Version before documenting |
| 6 | ✅ Pagination (#8) | Real apps never return all rows |
| 7 | MongoDB indexes (#19) | Next real performance win |
| 8 | Escape `?search` regex (#26) | User input must not be raw `$regex` |
| 9 | Supertest (#24) | Lock in what you built before deploy |

---

## Docs already written

| File | What |
|------|------|
| `authflow.md` | JWT, sign, verify, secret, token creation |
| `mongoStructure.md` | Collections, documents, linking, enterprise patterns |
| `readme.md` | API reference + full learning path |

---

> Say which **#** you want next — we'll do it step by step, same as auth and Point 4.
