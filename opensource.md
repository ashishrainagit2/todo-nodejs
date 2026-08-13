# Commercial Open Source — Node.js Projects to Study

A curated guide to **large, production-grade, commercial open-source** (or source-available) projects built on **Node.js / TypeScript**. Use this while learning the Todo API — read real code for auth, errors, rate limits, deploy, and scale.

**Related:** [`readme.md`](readme.md) learning path · [`learn.md`](learn.md) Q&A · [`todo.md`](todo.md) your checklist

---

## Progress legend

| Icon | Meaning |
|------|---------|
| ⭐ | GitHub stars (approximate — check repo for current count) |
| 🏢 | Commercial company behind the project |
| 🎓 | Good for learning backend patterns |
| ☁️ | Hosted cloud product exists |

---

## Table of contents

1. [What “commercial open source” means](#what-commercial-open-source-means)
2. [License models you will see](#license-models-you-will-see)
3. [How to study any repo (method)](#how-to-study-any-repo-method)
4. [Map to your Todo API topics](#map-to-your-todo-api-topics)
5. [Next pick — same topic surface, more depth](#next-pick--same-topic-surface-more-depth)
6. [Tier 1 — Best for learning REST + auth + errors](#tier-1--best-for-learning-rest--auth--errors)
7. [Tier 2 — Y Combinator companies](#tier-2--y-combinator-companies)
8. [Tier 3 — Google open source (Node)](#tier-3--google-open-source-node)
9. [Tier 4 — Large commercial Node platforms](#tier-4--large-commercial-node-platforms)
10. [Tier 5 — Auth & identity (Node/TS)](#tier-5--auth--identity-nodets)
11. [Tier 6 — Commerce & CMS](#tier-6--commerce--cms)
12. [Tier 7 — Automation & workflows](#tier-7--automation--workflows)
13. [Tier 8 — Developer tools & BaaS](#tier-8--developer-tools--baas)
14. [Recommended study order (for you)](#recommended-study-order-for-you)
15. [Clone & first-hour checklist](#clone--first-hour-checklist)
16. [What NOT to expect](#what-not-to-expect)
17. [Links quick reference](#links-quick-reference)

---

## What “commercial open source” means

These are **real businesses** whose core product is **readable on GitHub**, but revenue comes from:

| Revenue stream | Example |
|----------------|---------|
| **Hosted cloud** | PostHog Cloud, Strapi Cloud, Ghost(Pro), Cal.com hosted |
| **Enterprise / EE folder** | Features in `ee/` or `enterprise/` require paid license |
| **Commercial license** | AGPL project — free to self-host, paid license for private commercial derivative |
| **Support & services** | Vendure Platform, consulting, SLA |
| **Usage-based infra** | Medusa Cloud, n8n cloud executions |

**You can read and learn from all of it.** Using it in **your** commercial product may have license rules — always read `LICENSE`, `ee/LICENSE`, and pricing pages.

### Common architecture pattern: Open Core

```
repo/
├── packages/          ← 95% MIT / Apache — fully open
├── apps/
├── ee/                ← Enterprise Edition — commercial license
│   ├── sso/
│   ├── audit-logs/
│   └── advanced-auth/
└── LICENSE.md
```

**Examples:** PostHog (`ee/`), Cal.com (`ee/`), Mastra (`ee/`), n8n (files with `.ee.` in name)

---

## License models you will see

| Model | OSI “open source”? | Examples | What it means for you |
|-------|-------------------|----------|------------------------|
| **MIT / Apache 2.0** | ✅ Yes | Medusa, Ghost, Better Auth, google-cloud-node | Very permissive — learn freely, use in products with attribution |
| **Open core + EE license** | Partial | PostHog, Mastra, Vendure Platform | Core OSS; enterprise features need license |
| **AGPLv3** | ✅ Yes, with network copyleft | Cal.com, Vendure (core) | If you modify and serve over network, you may need to share source |
| **Fair-code / Sustainable Use** | ❌ Not OSI | n8n, Directus (MSCL) | Source visible; **commercial resale / competing service** restricted |
| **BSL** | ❌ Not OSI (converts later) | Some infra tools | Time-limited source availability |

**Learning rule:** Reading code on GitHub is always fine. **Shipping** a fork as your SaaS requires reading the license.

---

## How to study any repo (method)

### Step 1 — Orient (15 min)

```bash
git clone <repo-url>
cd <repo>
```

Look for:

| File / folder | What it tells you |
|---------------|-------------------|
| `README.md` | Stack, run commands, license |
| `package.json` / `pnpm-workspace.yaml` | Monorepo? Node version? |
| `docker-compose.yml` | Local DB + services |
| `apps/` vs `packages/` | Monorepo layout |
| `ee/` or `enterprise/` | Paid features boundary |
| `CONTRIBUTING.md` | How they expect PRs |

### Step 2 — Find the HTTP entry point

Search the repo:

```
grep -r "listen(" --include="*.ts" --include="*.js"
grep -r "createServer" 
grep -r "express()" 
grep -r "NestFactory"
```

Trace: **entry file → middleware → routes → controllers/services → DB**

### Step 3 — Search by topic (your Todo API curriculum)

| Your topic | Search terms |
|------------|--------------|
| Rate limiting | `rate-limit`, `rateLimit`, `throttle`, `@nestjs/throttler` |
| Global errors | `errorHandler`, `AppError`, `exception filter`, `middleware/error` |
| Auth / JWT | `jwt`, `protect`, `passport`, `session`, `better-auth` |
| Validation | `zod`, `joi`, `class-validator`, `express-validator` |
| Health check | `/health`, `healthz`, `readiness`, `liveness` |
| Logging | `morgan`, `winston`, `pino`, `logger` |
| CORS | `cors(` |
| Helmet | `helmet(` |
| Pagination | `page`, `limit`, `cursor`, `offset` |
| Transactions | `transaction`, `$transaction`, `startSession` |
| WebSocket | `socket.io`, `ws`, `WebSocketGateway` |
| Tests | `supertest`, `jest`, `vitest`, `*.spec.ts` |
| CI/CD | `.github/workflows` |

### Step 4 — Read one request end-to-end

Pick **one route** (e.g. `POST /login` or `GET /users/me`) and follow:

```
HTTP request → middleware chain → handler → service → ORM/DB → response
```

Draw it like your `learn.md` register flow.

### Step 5 — Compare to your Todo API

| Question | Your Todo API | Their project |
|----------|---------------|---------------|
| Where is auth middleware? | `middleware/auth.js` | ? |
| Where are errors centralized? | `app.js` global handler | ? |
| How is validation done? | Mongoose schema | Zod? class-validator? |
| How is DB accessed? | Mongoose | Prisma? TypeORM? Knex? |

---

## Map to your Todo API topics

| Todo API topic (readme) | What to look for in big repos |
|-------------------------|-------------------------------|
| Express + routes + controllers | `routes/`, `controllers/`, `apps/api/` |
| JWT auth | `middleware/auth`, `passport`, `jwt`, `session` |
| Rate limiting | `rate-limit`, Redis-backed limiters |
| Status codes / AppError | `AppError`, `HttpException`, `exception.filter` |
| MongoDB / indexes | Prisma schema, migrations, `@@index` |
| CORS + Helmet | `app.use(cors`, `helmet(` |
| Pagination | `take/skip`, cursor pagination |
| Caching | Redis, `@CacheKey`, in-memory |
| WebSocket / gRPC | `gateway`, `grpc`, `@grpc` |
| ACID transactions | `prisma.$transaction`, `queryRunner` |
| Deploy / CI | `.github/workflows`, Dockerfile, Helm |
| Concurrent connections | clustering, PM2, queue workers |

---

## Next pick — same topic surface, more depth

> **Verified snapshot: August 2026.** Star counts, issue counts, and file paths below were checked against the GitHub API on 12 Aug 2026. Treat numbers as a point-in-time reading; paths are on each repo's default branch.

### Selection rule used here

The domain does **not** matter — a forum, a CMS, and a habit tracker all expose the same HTTP surface you built. What matters is that the repo covers **your topics at production scale**:

| Must cover | Your file | Why it earns a spot |
|---|---|---|
| Routing + versioning | `routes/v1.js` | Real repos version APIs and keep old versions alive |
| CRUD + ownership scoping | `controllers/task.js` | `userId` filters, bulk ops, query/sort allowlists |
| Auth | `middleware/auth.js` | Sessions, tokens, API keys, permission checks |
| Rate limiting | `middleware/rateLimit.js` | Multi-process counters, not in-memory toys |
| Errors | `utils/AppError.js` + global handler | Operational vs programmer errors, leak prevention |
| Validation | `validateTaskBody`, Mongoose schema | Allowlists, normalisation, schema-level constraints |
| Logging / health | morgan, `/health` | Structured logs, readiness vs liveness |
| Multi-process | `learn.md` §19 | Clustering, workers, shared state |

**Hard requirement: Node + Express.** The database is negotiable — Mongo, Postgres, MySQL and Redis all teach the same lessons at the HTTP layer, and watching a repo swap between them is a bonus rather than a cost. The **framework is not negotiable**. Reading Koa, Nest, or Next means spending your attention on an unfamiliar request lifecycle instead of on the thing you came for, and nothing transfers back to `app.js` line for line.

| Pick | Framework | Database | Primary learning target? |
|---|---|---|---|
| Habitica | Express | MongoDB via Mongoose | **Yes** — identical stack to yours |
| NodeBB | Express | MongoDB / Redis / PostgreSQL, chosen per install | **Yes** — and the swap layer is itself a lesson |
| Ghost | Express | MySQL / SQLite via Knex | **Yes** — SQL instead of Mongo, same API concerns |
| Medusa | Express, under its own routing layer | PostgreSQL | **Yes**, with a TypeScript tax |
| Fastify | *not* Express — it is the alternative | agnostic | No — contrast read, see §6 |
| BullMQ | not a web framework at all | Redis or PostgreSQL | No — depth read, see §7 |

**Excluded on purpose:** repos where the interesting code is not the Node HTTP layer. Cal.com (Next + Prisma + tRPC), PostHog (Django + ClickHouse), Vendure (NestJS + GraphQL), Strapi and Directus (Koa, plus schema-generated APIs that hide the layer you want to study). All are worth reading eventually; none of them teach *your* layer.

---

### 1. Habitica — the closest architectural twin ⭐ ~14k · 🎓

| | |
|---|---|
| **GitHub** | https://github.com/HabitRPG/habitica |
| **Stack** | **Plain JavaScript**, **Express**, **Mongoose**, MongoDB, Vue client |
| **Activity** | v5.48.2 released Jun 2026; last push Jul 2026; 350 contributors; default branch `develop` |
| **License** | Non-standard (`NOASSERTION` on GitHub) — read `LICENSE` before reusing code |
| **Why this one** | Same language, same framework, same ODM. Repo created 2012 — it is your `app.js` after fourteen years of production traffic |

**File-for-file mapping** (all paths under `website/server/`):

| Your file | Habitica equivalent |
|---|---|
| `middleware/auth.js` | `middlewares/auth.js` |
| `AppError` + global handler in `app.js` | `middlewares/errorHandler.js`, `libs/apiError.js`, `libs/errors.js` |
| 404 catch-all | `middlewares/notFound.js` |
| morgan setup | `middlewares/requestLogHandler.js`, `libs/logger.js` |
| `cors()` config | `middlewares/cors.js` |
| `middleware/rateLimit.js` | `middlewares/rateLimiter.js` |
| `express.json()` / `urlencoded()` | `middlewares/setupBody.js` |
| `express.static('public')` | `middlewares/static.js` |
| Middleware order in `app.js` | `libs/setupExpress.js`, `middlewares/index.js`, `middlewares/appRoutes.js` |
| `/health` | `libs/serverStatus.js` |
| Mongoose connect + `syncIndexes()` | `libs/mongoose.js`, `libs/mongodb.js` |
| `/api/v1` mounting | `middlewares/v1.js`, `controllers/api-v3/`, `controllers/api-v4/` |
| `models/task.js` | `models/task.js` |
| Swagger via `swagger-jsdoc` | `api-doc.js` (apidoc-style generation) |

**Read in this order:**

1. `libs/setupExpress.js` — diff it against your `app.js` middleware order. Highest value per minute in this list.
2. `controllers/api-v3/` vs `controllers/api-v4/` — how you keep v3 frozen for third-party clients while v4 evolves for your own web and mobile apps. This is the versioning problem your `routes/v1.js` will hit.
3. `middlewares/errorHandler.js` + `libs/errors.js` — a mature version of your `AppError` split.
4. `middlewares/ensureAccessRight.js` — permission layer above `protect`.

**Where it gets genuinely hard** (worth your time as an experienced dev):

- `libs/cron.js` — daily reset per user, in the user's own timezone, with a custom day-start hour. Idempotency and clock-skew problems that a CRUD API never forces you to solve.
- `libs/worker.js`, `libs/redis.js` — background work and shared state across processes.
- The `mongodb transactions` label on the issue tracker — multi-document consistency in Mongoose.
- `middlewares/blocker.js`, `middlewares/domain.js`, `middlewares/maintenanceMode.js` — operational middleware you have not needed yet.

**Contribution reality — set expectations:** bug reports go to `admin@habitica.com`, *not* the issue tracker. The `Help Wanted` label their wiki still references no longer exists on the repo (I checked the full label list). The `type: medium level coding` queue is ten issues dated 2015–2022, mostly Vue and game logic. The two that touch API shape and match your validation work:

| Issue | What |
|---|---|
| [#12886](https://github.com/HabitRPG/habitica/issues/12886) | Empty challenge summary is not replaced by title across all API routes (updated Jun 2026) |
| [#13010](https://github.com/HabitRPG/habitica/issues/13010) | Require challenges to have a summary in API v4 |

Note also that `section: API` has only **two** open issues total — both of the above, one of them marked `status: issue: on hold`. The backend queue is thin; treat Habitica as a read-first repo and a contribute-second one.

**Local dev on Windows.** Their setup guide targets Debian-based Linux and warns other platforms may need extra work, so use Docker Desktop or WSL2 rather than fighting native paths. Two supported modes:

| Mode | What runs where |
|---|---|
| All Docker | Database, server, and web client in containers — one command, least fiddling |
| Hybrid | MongoDB in Docker; Express server and Vite client as local Node processes — more terminal juggling, finer control over restarting one piece |

The client serves on `http://localhost:5173`, and you register a normal account against your local install. Most edits hot-reload, but changes under `website/common` — `website/common/locales` especially — need the Express process restarted.

**PR conventions** (they enforce these):

- Branch from `upstream/develop`, never from `master`.
- PR title must be self-explanatory on its own, plus `fixes #1234` or `partial fix for #1234` at the end — and repeat the reference in the body.
- First-time contributors: CI will not run until a maintainer approves the workflow. Leave a comment asking an admin to start it, otherwise your PR sits with no checks and looks stalled.

---

### 2. NodeBB — Express at scale, and it answers your §19 questions ⭐ ~15k · 🎓

| | |
|---|---|
| **GitHub** | https://github.com/NodeBB/NodeBB |
| **Stack** | **JavaScript**, **Express**, custom database layer over MongoDB / Redis / PostgreSQL |
| **Activity** | Very active mid-2026 — ActivityPub federation work, `mongodb` driver on 7.4 |
| **Branches** | `master` = bug fixes, `develop` = features. PRs to the wrong one get redirected |

**Why this is the strongest pick if you want depth over familiarity:** NodeBB has already solved, in readable JavaScript, the exact problems you wrote up in `learn.md` §19.

| Question you asked | Where NodeBB answers it |
|---|---|
| bcrypt blocks the event loop — what do real apps do? | `src/password_worker.js` — `bcryptjs` inside a `workerpool` worker, so hashing never runs on the request thread |
| Rate limiter counters live in memory and break under clustering | `src/middleware/ratelimit.js` + `src/pubsub.js` for cross-process messaging |
| How do you carry request context without passing `req` everywhere? | `src/als.js` — `AsyncLocalStorage` |
| Where is the HTTP entry point in a big app? | `src/webserver.js`, `src/start.js`, `src/prestart.js` |
| REST write API layout | `src/routes/write/`, `src/controllers/write/`, `src/api/` |
| Swapping the database without touching controllers | `src/database/` adapters |
| Scheduled work | `src/cron.js`, `src/batch.js` |

Also worth reading: `src/middleware/csrf.js`, `headers.js`, `assert.js`, and the plugin/hook system in `src/plugins/` — the pattern you would need if the Todo API ever grew extensions.

**Contribution reality:** the `good first issue` label exists but had zero open issues when I checked, so the path in is to pick a confirmed bug or work in the `activitypub` area, which is where active development is. Maintainer review is detailed and technical — PR [#14447](https://github.com/NodeBB/NodeBB/pull/14447) shows an outside contributor getting real architectural feedback (URL resolution breaking subpath installs, caught only by the Redis CI job running under `/forum`). That review thread alone is a good lesson in why CI matrices exist.

---

### 3. Medusa — read the framework, then land a PR ⭐ ~35k · MIT

| | |
|---|---|
| **GitHub** | https://github.com/medusajs/medusa |
| **Stack** | **TypeScript** monorepo, Express under the hood, PostgreSQL |
| **Activity** | Nine open `good first issue` bugs filed Jul–Aug 2026, unassigned. The only candidate with a live, labelled queue |

**What to read** — `packages/core/framework/src/http/` is a routing and middleware framework built on top of Express, which is the natural next step after wiring `app.js` by hand:

| File | What it does |
|---|---|
| `express-loader.ts` | Boots the Express app |
| `routes-loader.ts`, `routes-finder.ts`, `routes-sorter.ts` | File-system based routing — sort order decides middleware precedence |
| `middleware-file-loader.ts`, `utils/define-middlewares.ts` | User-supplied middleware, merged into the chain |
| `middlewares/authenticate-middleware.ts` | Your `protect`, generalised over multiple auth strategies |
| `middlewares/error-handler.ts`, `exception-formatter.ts` | Your `AppError` + global handler split into transform and respond |
| `utils/validate-body.ts`, `validate-query.ts` | Your `validateTaskBody`, schema-driven |
| `utils/wrap-handler.ts` | Async error forwarding — the thing that makes `try/catch` in controllers optional |
| `utils/unless-path.ts`, `http-compression.ts` | Conditional middleware application |

**Concrete PR available** — [#16368 `unlessPath` alternates behavior with global or sticky regular expressions](https://github.com/medusajs/medusa/issues/16368), filed 9 Aug 2026, unassigned:

`unless-path.ts` stores the caller's `RegExp` and calls `onPath.test(req.path)` per request. If the caller passed a `/g` or `/y` regex, `test()` advances `lastIndex` on a match, so the *same* path alternates between skipping and running the middleware on consecutive requests:

```js
const path = /^\/health/g;
path.test('/health'); // true  → middleware skipped
path.test('/health'); // false → middleware runs
```

Fix is a few lines — strip `g`/`y` into a local copy (`new RegExp(source, flags.replace(/[gy]/g, ''))`) or reset `lastIndex` before testing — plus a unit test in `http/utils/__tests__` that hits the same path twice and asserts identical behaviour. Small surface, and the bug class (stateful regex reused across requests) is worth internalising: your own `$regex` search in `controllers/task.js` builds a fresh regex per request, which is why it is safe.

**Two more from the same queue**, both open and unassigned, if `unless-path` gets taken:

| Issue | What | Why it is interesting |
|---|---|---|
| [#16271](https://github.com/medusajs/medusa/issues/16271) | `@medusajs/test-utils` runner mutates `process.env` and never restores it | Test isolation and global-state leakage between suites — the reason your own tests will eventually go flaky |
| [#16392](https://github.com/medusajs/medusa/issues/16392) | Product tags list loader forwards prefixed URL params (`ptag_order`) when view configurations are enabled | Query-param namespacing across a list endpoint — same class of problem as your sort allowlist in `controllers/task.js` |

Harder surfaces in the same repo if you want more: the workflows engine, and the module boundary system.

---

### 4. Ghost — mature Node, two API surfaces ⭐ ~54k · MIT

`ghost/core/core/server/` splits into `web/` (the Express apps), `api/` (endpoint framework), `services/`, `models/`, `data/`. The lesson here is the **Content API vs Admin API** separation: same data, two surfaces, different auth and different rate limits. Relevant the moment your Todo API gets a public read-only surface. MIT-licensed, so no reuse worries.

---

### 5. Read the middleware you already `require()`

Small repos, exact topic match, and you have already documented their behaviour in `revision-1.md`:

| Package | Why read the source |
|---|---|
| [express](https://github.com/expressjs/express) | `router/layer.js` and `router/route.js` — how the chain you drew actually dispatches |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | `source/rate-limit.ts` is the whole middleware; `source/memory-store.ts` is the per-process counter that clustering multiplies; `source/headers.ts` covers draft vs legacy `RateLimit-*` headers; `source/validations.ts` shows the footguns they guard against. Four open issues, all design discussions: [#309](https://github.com/express-rate-limit/express-rate-limit/issues/309) per-request cost, [#441](https://github.com/express-rate-limit/express-rate-limit/issues/441) `retryAfter` + IP blocking, [#544](https://github.com/express-rate-limit/express-rate-limit/issues/544) lockout time, [#122](https://github.com/express-rate-limit/express-rate-limit/issues/122) dynamic `windowMs` |
| helmet, morgan | Tiny, single-purpose, readable end to end in one sitting |

**Callback to your own question:** you asked why a correct URL with the wrong HTTP method returns 404 instead of 405. Express issue [#2414 — "route() should handle 405 Method not allowed"](https://github.com/expressjs/express/issues/2414) has been open since **October 2014** and is labelled `help wanted`. Your instinct was right, and the framework agrees it is unresolved.

---

### 6. Fastify — the contrast read ⭐ ~37k · MIT

> **Not an Express app, so not a primary target.** It is the control experiment: every decision Express leaves to you, Fastify makes explicit and names. One weekend here changes how you read your own `app.js`.

| | |
|---|---|
| **GitHub** | https://github.com/fastify/fastify |
| **Stack** | **JavaScript**, its own HTTP framework, database-agnostic |
| **Activity** | Pushed Aug 2026, ~131 open issues, MIT, default branch `main` |
| **Size** | `lib/` is 34 files — genuinely finishable, unlike every other repo in this section |

`lib/` maps onto the choices you made by hand:

| Your decision | Fastify's version | What it teaches |
|---|---|---|
| Middleware order in `app.js` | `hooks.js` | A named lifecycle (`onRequest`, `preValidation`, `preHandler`, `onSend`) instead of one flat chain where order is implicit |
| `validateTaskBody` allowlists | `schema-controller.js`, `validation.js`, `schemas.js` | JSON Schema compiled into a validator function per route — declarative, and faster than hand-written checks |
| `express.json()` / `urlencoded()` | `content-type-parser.js`, `content-type.js` | Body parsing as a registry keyed by content type, with size and encoding handled once |
| `AppError` + global handler | `error-handler.js`, `errors.js`, `error-serializer.js`, `error-status.js` | Separating "classify the error" from "serialise the response" |
| `try/catch` in every controller | `wrap-thenable.js`, `handle-request.js` | Rejected promises routed to the error handler by the framework |
| Your 404 catch-all | `four-oh-four.js` | A first-class component — the same problem Express left open in [#2414](https://github.com/expressjs/express/issues/2414) |
| `morgan` | `log-controller.js`, `logger-factory.js`, `logger-pino.js`, `req-id-gen-factory.js` | Structured logging with a per-request id, versus morgan's text lines |
| Router mounting | `route.js`, `plugin-override.js`, `plugin-utils.js`, `context.js` | Encapsulation — plugins get an isolated scope, so one route's decorators cannot leak into another |

Read `hooks.js` and `four-oh-four.js` first. Contributions are welcome and substantive, but the bar is tests, benchmarks and coverage — which is itself worth seeing.

---

### 7. BullMQ — the depth read ⭐ ~9k · MIT

> **A library, not an app.** Included because it is the highest learning-per-line repo in this file, and because it fixes two things your Todo API currently cannot do.

| | |
|---|---|
| **GitHub** | https://github.com/taskforcesh/bullmq |
| **Stack** | **TypeScript**, backed by **Redis or PostgreSQL**; clients for Python, .NET, Elixir, Rust, PHP |
| **Activity** | Pushed Aug 2026, ~374 open issues, MIT, default branch `master` |

**What it fixes in your app:**

1. Long work in the request path — hashing, report generation, sending mail — moves to a worker, so the event loop stays free (`learn.md` §19).
2. A Redis-backed store makes your rate limiter correct under clustering, instead of every worker keeping its own counter and multiplying the allowance.

**Where the learning is** — `src/commands/` holds **52 Lua scripts**, which is a queue's entire state machine written as atomic Redis operations. The number in each filename is the key count the script touches, so `moveToFinished-14.lua` mutates fourteen keys in one indivisible step:

| File | Concept |
|---|---|
| `moveToActive-11.lua`, `moveToFinished-14.lua`, `moveToDelayed-12.lua` | State transitions that cannot half-apply, without a transaction |
| `extendLock-2.lua`, `releaseLock-1.lua`, `moveStalledJobsToWait-9.lua` + `classes/lock-manager.ts` | Lease-based locking and crash recovery — how a queue notices a worker died mid-job and safely re-runs the work |
| `getRateLimitTtl-2.lua`, `isMaxed-2.lua` | Rate limiting as a distributed primitive rather than an in-memory counter |
| `addDelayedJob-6.lua`, `addJobScheduler-11.lua` + `classes/job-scheduler.ts` | Scheduled and repeating work without cron |
| `addParentJob-6.lua`, `moveToWaitingChildren-7.lua` + `classes/flow-producer.ts` | Job dependency graphs |
| `classes/child-pool.ts`, `sandbox.ts`, `child-processor.ts` | Running job code in separate processes for isolation |
| `classes/backoffs.ts` | Retry with backoff — the correct version of the retry loop everyone hand-rolls |

Reading `moveStalledJobsToWait-9.lua` alongside `lock-manager.ts` teaches idempotency and at-least-once delivery concretely, not by analogy. PRs at the Lua level are hard and high-value.

---

### Queue health snapshot — checked 12 Aug 2026

Why some obvious candidates are not in the list above. "Open issues" counts exclude pull requests.

| Repo | Labelled queue | Reading |
|---|---|---|
| **medusajs/medusa** | 9 open `good first issue`, filed Jul–Aug 2026, unassigned | Healthy and actively triaged — the only live queue found |
| **express-rate-limit** | 4 open issues total, 2019–2025 | Not bugs; all four are API design discussions worth an opinion |
| **expressjs/express** | 0 `good first issue`, 2 `help wanted` | One is [#6353](https://github.com/expressjs/express/issues/6353) diagnostic channels (2025), the other [#2414](https://github.com/expressjs/express/issues/2414) from 2014 |
| **NodeBB/NodeBB** | label exists, 0 open | Repo is very active; the label is just unused. Enter via a confirmed bug or `activitypub` |
| **HabitRPG/habitica** | no `good first issue` **and no `Help Wanted` label at all** | 10 open `type: medium level coding`, dated 2015–2022; `section: API` has 2 |
| **requarks/wiki** (Wiki.js) | 0 open `good first issue` | Quiet queue |
| **payloadcms/payload** | 0 open `good first issue` | Quiet queue |
| **novuhq/novu** | 1 open `good first issue` | From Oct 2023 — effectively abandoned as an entry point |

**Curated lists go stale — verify before trusting.** `awesome-for-beginners` still lists Habitica under a `good first issue` label that no longer exists on the repo, and Habitica's own wiki still points contributors at a `Help Wanted` label that is also gone. Always read the live label list, not the guide.

---

### Re-run these checks yourself

The REST issues endpoint is the reliable one. Swap `OWNER/REPO` and the label:

```bash
# Every label a repo actually uses (catches renamed/removed labels)
curl -s "https://api.github.com/repos/OWNER/REPO/labels?per_page=100"

# Open issues carrying a label (URL-encode spaces and colons)
curl -s "https://api.github.com/repos/OWNER/REPO/issues?state=open&per_page=30&labels=good%20first%20issue"

# Habitica's real entry points
curl -s "https://api.github.com/repos/HabitRPG/habitica/issues?state=open&labels=type%3A%20medium%20level%20coding"
curl -s "https://api.github.com/repos/HabitRPG/habitica/issues?state=open&labels=section%3A%20API"
```

Compact triage of a queue — age and staleness matter more than count:

```js
// Save as triage.js, then: node triage.js
// No token needed for public repos — 60 requests/hour per IP.
// Wrap in an async IIFE: `node -e` has no top-level await.
(async () => {
  const url = 'https://api.github.com/repos/medusajs/medusa/issues'
    + '?state=open&per_page=30&labels=good%20first%20issue';

  const res = await fetch(url, { headers: { 'User-Agent': 'node' } });
  if (!res.ok) return console.log('HTTP', res.status);

  const issues = (await res.json()).filter(x => !x.pull_request); // /issues returns PRs too
  console.log('open issues:', issues.length);

  issues.forEach(x => console.log(
    '#' + x.number,
    x.created_at.slice(0, 10),
    '| upd', x.updated_at.slice(0, 7),
    '|', x.assignee ? x.assignee.login : 'unassigned',
    '|', x.title.slice(0, 70),
  ));
})();
```

**Three gotchas that cost me time here:**

1. `/issues` returns pull requests as well as issues. Filter on `x.pull_request` or your counts are inflated.
2. In the **search** API, `label:"a","b"` is not an OR — it silently matches nothing and returns `total_count: 0`, which reads exactly like "no open issues". Repo-scoped searches also returned `422` on one repo. Prefer `/repos/.../issues?labels=`.
3. Judge a queue by `created_at` and `updated_at`, not by size. Ten issues from 2015 is a closed door; nine from last month is an open one.

---

### Quick decision table

| Goal | Repo | First file to open |
|---|---|---|
| Same stack, maximum transfer to your code | Habitica | `website/server/libs/setupExpress.js` |
| Hardest Node problems, still plain Express | NodeBB | `src/password_worker.js`, `src/pubsub.js` |
| Framework-level routing/validation design, plus a mergeable PR | Medusa | `packages/core/framework/src/http/router.ts` |
| Two-API-surface product design | Ghost | `ghost/core/core/server/web/` |
| Deep on one middleware you already use | express-rate-limit | `source/rate-limit.ts`, `source/memory-store.ts` |
| Seeing your own `app.js` choices as choices | Fastify | `lib/hooks.js`, `lib/four-oh-four.js` |
| Queues, locks, retries, distributed state | BullMQ | `src/commands/moveStalledJobsToWait-9.lua`, `src/classes/lock-manager.ts` |

---

## Tier 1 — Best for learning REST + auth + errors

**Start here** after your Todo API. These are full products with APIs you can trace.

---

### Cal.com ⭐ ~41k · 🏢 · 🎓 · ☁️

| | |
|---|---|
| **GitHub** | https://github.com/calcom/cal.com |
| **Website** | https://cal.com |
| **What** | Open-source Calendly alternative — scheduling, bookings, teams |
| **Stack** | **Node.js**, **Next.js**, **TypeScript**, **Prisma**, PostgreSQL, tRPC |
| **Commercial** | YC company; **AGPLv3** + **EE** (`ee/`) for SSO, orgs, payments, etc.; [commercial license](https://cal.com/pricing) available |
| **Why study** | End-to-end product: auth, API routes, webhooks, teams, validation, real deploy |

**Study paths:**
- `apps/web/` — Next.js frontend + API routes
- `packages/trpc/` — typed API layer
- Search: `middleware`, `rateLimit`, `error`, `prisma`

**License note:** AGPL — understand network copyleft if you host a modified version publicly.

---

### PostHog ⭐ ~37k · 🏢 · 🎓 · ☁️

| | |
|---|---|
| **GitHub** | https://github.com/PostHog/posthog |
| **Website** | https://posthog.com |
| **What** | Product analytics, session replay, feature flags, experiments |
| **Stack** | **Node** + Python (Django) monorepo, TypeScript frontend, ClickHouse, Kafka at scale |
| **Commercial** | YC W20; MIT + **`ee/`** enterprise; [PostHog Cloud](https://posthog.com/pricing) |
| **Why study** | How a **high-traffic** commercial product handles ingestion API, auth, multi-tenancy |

**Also see:** [posthog-foss](https://github.com/PostHog/posthog-foss) — FOSS-only variant without proprietary code.

**Study paths:**
- API ingestion endpoints
- Feature flag evaluation
- `ee/` boundary — what is paid vs free

---

### Vendure ⭐ ~8k · 🏢 · 🎓 · ☁️

| | |
|---|---|
| **GitHub** | https://github.com/vendurehq/vendure |
| **Website** | https://vendure.io |
| **What** | Headless **e-commerce** platform — products, orders, payments |
| **Stack** | **Node.js**, **NestJS**, **GraphQL**, TypeScript |
| **Commercial** | GPLv3 core + [Vendure Platform](https://vendure.io/pricing) (SSO, B2B, etc.) |
| **Why study** | **Best “next step” after Express** — structured modules, guards, services, GraphQL |

**Study paths:**
- NestJS modules: `auth`, `order`, `product`
- GraphQL resolvers vs REST controllers
- Plugin architecture

**Maps to your learning:** Same concepts as Todo API (auth, CRUD, ownership) but in **NestJS** structure.

---

### Ghost ⭐ ~54k · 🏢 · 🎓 · ☁️

| | |
|---|---|
| **GitHub** | https://github.com/TryGhost/Ghost |
| **Website** | https://ghost.org |
| **What** | Publishing platform — blogs, memberships, newsletters |
| **Stack** | **Node.js**, JavaScript/TypeScript, Express-style core, SQLite/MySQL |
| **Commercial** | **MIT**; [Ghost(Pro)](https://ghost.org/pricing/) managed hosting |
| **Why study** | **Mature, long-lived Node codebase** — API design, members, webhooks |

**Study paths:**
- `ghost/core/` — main server
- Content API + Admin API separation
- Membership / Stripe integration

---

## Tier 2 — Y Combinator companies

YC-backed startups often ship **OSS core + commercial cloud**. Good signal for production quality.

| Project | Batch | GitHub | Stars | Stack | What | Commercial |
|---------|-------|--------|-------|-------|------|------------|
| **PostHog** | W20 | [PostHog/posthog](https://github.com/PostHog/posthog) | ~37k | Node + Python | Analytics platform | Cloud + `ee/` |
| **Cal.com** | — | [calcom/cal.com](https://github.com/calcom/cal.com) | ~41k | Node, Next, Prisma | Scheduling | Cloud + EE |
| **Better Auth** | S25 | [better-auth/better-auth](https://github.com/better-auth/better-auth) | ~13k+ | TypeScript | Auth framework | OSS + infra layer |
| **Mastra** | W25 | [mastra-ai/mastra](https://github.com/mastra-ai/mastra) | ~27k | TypeScript, Node | AI agents / workflows | Apache + `ee/` |
| **Tambo** | — | [tambo-ai/tambo](https://github.com/tambo-ai/tambo) | ~11k | TypeScript, Node | Generative UI + backend | MIT + [Tambo Cloud](https://tambo.co) |

### Better Auth — deep dive (pairs with your JWT work)

| | |
|---|---|
| **GitHub** | https://github.com/better-auth/better-auth |
| **YC** | https://www.ycombinator.com/companies/better-auth |
| **What** | Framework-agnostic auth for TypeScript — sessions, OAuth, plugins |
| **Why study** | See how a **modern auth library** handles what you built manually (register, login, tokens) |

**Compare to your Todo API:**
- Your `middleware/auth.js` → their session/JWT plugins
- Your `User` model + bcrypt → their adapter pattern
- Your global error handler → their typed error responses

### Mastra — AI + Node backend

| | |
|---|---|
| **GitHub** | https://github.com/mastra-ai/mastra |
| **What** | TypeScript framework for AI agents, tools, workflows |
| **Stack** | Node, integrates with Next.js / React |
| **License** | Apache 2.0 core + Mastra Enterprise License in `ee/` |

**Why study:** If you later add AI to Todo API (smart task suggestions), see how they structure agents + API servers.

---

## Tier 3 — Google open source (Node)

Google’s Node repos are mostly **SDKs and runtimes**, not full CRUD apps like your Todo API.

### google-cloud-node ⭐ ~3k (monorepo — massive)

| | |
|---|---|
| **GitHub** | https://github.com/googleapis/google-cloud-node |
| **Website** | https://cloud.google.com/nodejs |
| **What** | Official **client libraries** for every GCP service (Storage, Pub/Sub, Firestore, etc.) |
| **License** | Apache 2.0 |
| **Why study** | How Google structures **npm packages**, retries, auth, gRPC vs REST clients |

**Not a Todo-style app** — study for **client library design**, not Express routing.

---

### Functions Framework for Node.js ⭐ ~1.4k

| | |
|---|---|
| **GitHub** | https://github.com/GoogleCloudPlatform/functions-framework-nodejs |
| **What** | FaaS framework — write functions that run on **Cloud Functions / Cloud Run** |
| **Stack** | **Express-based** |
| **License** | Apache 2.0 |

**Why study:** Small, readable — see minimal HTTP server + Google’s deployment model.

```bash
npm install @google-cloud/functions-framework
```

---

### google-api-nodejs-client ⭐ ~12k

| | |
|---|---|
| **GitHub** | https://github.com/googleapis/google-api-nodejs-client |
| **What** | Client for **Google APIs** (Gmail, Drive, YouTube, etc.) |
| **License** | Apache 2.0 |
| **Status** | Maintenance mode for new features — use `google-cloud-node` for GCP |

**Why study:** OAuth2 flow, API key auth, generated clients — useful for integrations, not backend CRUD.

---

### Other Google-related Node tools

| Project | Link | Notes |
|---------|------|-------|
| **Firebase Admin SDK** | [firebase-admin-node](https://github.com/firebase/firebase-admin-node) | Server-side Firebase — auth verify, Firestore |
| **Angular** (not backend) | [angular/angular](https://github.com/angular/angular) | Google-backed frontend — skip for Node backend focus |

**Bottom line for Google:** Learn **SDK patterns** and **Cloud Run/Functions** deployment — not full app architecture.

---

## Tier 4 — Large commercial Node platforms

---

### Strapi ⭐ ~72k · 🏢 · 🎓 · ☁️

| | |
|---|---|
| **GitHub** | https://github.com/strapi/strapi |
| **Website** | https://strapi.io |
| **What** | Headless **CMS** — content types, REST/GraphQL, admin panel |
| **Stack** | **Node.js**, **TypeScript**, Koa-based core |
| **Commercial** | [Strapi Cloud](https://strapi.io/pricing), enterprise features |

**Why study:** Auto-generated REST API from schema — compare to your manual Mongoose routes.

**Related repos:**
- [strapi/design-system](https://github.com/strapi/design-system) — React UI
- [strapi/LaunchPad](https://github.com/strapi/LaunchPad) — Strapi + Next.js demo

---

### Directus ⭐ ~32k · 🏢 · 🎓 · ☁️

| | |
|---|---|
| **GitHub** | https://github.com/directus/directus |
| **Website** | https://directus.com |
| **What** | Wrap any **SQL DB** → instant REST + GraphQL + admin UI |
| **Stack** | **Node.js**, TypeScript, Vue admin |
| **License** | **MSCL** (Monospace Sustainable Core) — free under revenue/employee thresholds |
| **Commercial** | [Directus Cloud](https://directus.com/pricing), commercial license for larger orgs |

**Why study:** Auth, permissions, hooks, extensions — enterprise-grade API layer on SQL.

---

### n8n ⭐ ~130k+ · 🏢 · 🎓 · ☁️

| | |
|---|---|
| **GitHub** | https://github.com/n8n-io/n8n |
| **Website** | https://n8n.io |
| **What** | **Workflow automation** — connect APIs, webhooks, cron, AI nodes |
| **Stack** | **Node.js**, TypeScript, Vue frontend |
| **License** | **Sustainable Use License** (fair-code — not OSI open source) |
| **Commercial** | [n8n Cloud](https://n8n.io/pricing); `.ee.` files = Enterprise License |

**Why study:** Massive Node codebase — queues, webhooks, credential storage, execution engine.

**License note:** n8n calls itself **fair-code**, not open source (OSI). Fine for learning; read license before reselling as automation SaaS.

---

### Appwrite ⭐ ~53k · 🏢 · 🎓 · ☁️

| | |
|---|---|
| **GitHub** | https://github.com/appwrite/appwrite |
| **Website** | https://appwrite.io |
| **What** | **Backend-as-a-Service** — auth, DB, storage, functions |
| **Stack** | **Node** (PHP core historically; check current — Appwrite uses multi-language runtime) |
| **Commercial** | [Appwrite Cloud](https://appwrite.io/pricing) |

**Why study:** Compare to building Todo API yourself — they productize auth + CRUD + storage.

---

### Outline ⭐ ~35k · 🏢 · 🎓 · ☁️

| | |
|---|---|
| **GitHub** | https://github.com/outline/outline |
| **Website** | https://www.getoutline.com |
| **What** | Team **wiki / knowledge base** (Notion-like) |
| **Stack** | **Node.js**, React, PostgreSQL, Redis |
| **License** | BSL 1.1 (business source license) |
| **Commercial** | Hosted Outline, enterprise |

**Why study:** Real-time collaboration, permissions, Slack integration, polished Node API.

---

### Payload CMS ⭐ ~38k · 🏢 · 🎓 · ☁️

| | |
|---|---|
| **GitHub** | https://github.com/payloadcms/payload |
| **Website** | https://payloadcms.com |
| **What** | **Code-first headless CMS** — Next.js native |
| **Stack** | **Node.js**, TypeScript, MongoDB or Postgres |
| **Commercial** | [Payload Cloud](https://payloadcms.com/cloud) |

**Why study:** Modern TS patterns, hooks, access control — closer to your stack if you stay on MongoDB.

---

## Tier 5 — Auth & identity (Node/TS)

| Project | GitHub | What | Commercial |
|---------|--------|------|------------|
| **Better Auth** | [better-auth/better-auth](https://github.com/better-auth/better-auth) | Full auth framework | YC + hosted infra |
| **Stack Auth / Hexclave** | [stack-auth/stack](https://github.com/stack-auth/stack) | User management for Next.js | Cloud tier |
| **Lucia** (archived/evolved) | Community auth patterns | Session auth education | — |
| **Keycloak** | Java, not Node — listed for comparison | Enterprise IAM | Red Hat / OSS |

**For your Todo API:** After JWT basics, read **Better Auth** source — it shows production auth plugin architecture.

---

## Tier 6 — Commerce & CMS

| Project | GitHub | Stars | Stack | Commercial |
|---------|--------|-------|-------|------------|
| **Medusa** | [medusajs/medusa](https://github.com/medusajs/medusa) | ~35k | Node, TS, modular commerce | MIT + [Medusa Cloud](https://medusajs.com) |
| **Vendure** | [vendurehq/vendure](https://github.com/vendurehq/vendure) | ~8k | NestJS, GraphQL | GPL + Platform |
| **Strapi** | [strapi/strapi](https://github.com/strapi/strapi) | ~72k | Node, TS, CMS | Strapi Cloud |
| **Saleor** | [saleor/saleor](https://github.com/saleor/saleor) | ~22k | Python GraphQL — not Node | Saleor Cloud |

### Medusa — commerce modules

| | |
|---|---|
| **What** | Modular e-commerce — cart, orders, products, payments |
| **Why study** | Clean **module boundaries** — how to split a big backend into packages |
| **Docs** | https://docs.medusajs.com |

---

## Tier 7 — Automation & workflows

| Project | GitHub | What |
|---------|--------|------|
| **n8n** | [n8n-io/n8n](https://github.com/n8n-io/n8n) | Visual workflow automation |
| **Temporal** | [temporalio/temporal](https://github.com/temporalio/temporal) | Durable workflows (Go SDK primary; Node SDK exists) |
| **BullMQ** | [taskforcesh/bullmq](https://github.com/taskforcesh/bullmq) | Redis job queues for Node — used inside many commercial apps. Full write-up as §7 of [Next pick](#next-pick--same-topic-surface-more-depth) |

**Maps to readme:** Background jobs, offloading heavy work from HTTP request.

---

## Tier 8 — Developer tools & BaaS

| Project | GitHub | What | Node relevance |
|---------|--------|------|----------------|
| **Supabase** | [supabase/supabase](https://github.com/supabase/supabase) | Firebase alternative | Postgres + JS client; Edge Functions (Deno) |
| **Hasura** | [hasura/graphql-engine](https://github.com/hasura/graphql-engine) | GraphQL on Postgres | Haskell core; Node clients |
| **Novu** | [novuhq/novu](https://github.com/novuhq/novu) | Notification infrastructure | **Node** API for email/SMS/push |
| **Dokploy** | [Dokploy/dokploy](https://github.com/Dokploy/dokploy) | Self-hosted PaaS | Node — learn deploy patterns |
| **Wiki.js** | [requarks/wiki](https://github.com/requarks/wiki) | Wiki on Node | Express + PostgreSQL |

---

## Recommended study order (for you)

> **Superseded for the immediate next pick.** See [Next pick — same topic surface, more depth](#next-pick--same-topic-surface-more-depth). The order below is a *breadth* tour across frameworks and business models; the section above is a *depth* tour of your own topics (routing, CRUD, auth, rate limiting, errors) in codebases that still use Express and Mongoose. Do the depth tour first, then come back here when you want to see Nest, Prisma, tRPC, and GraphQL.

Based on your Todo API progress (Express, JWT, rate limit, global errors):

| Order | Repo | Why now |
|-------|------|---------|
| **1** | [Cal.com](https://github.com/calcom/cal.com) | Full product — auth, API, Prisma, same “build a real app” feel |
| **2** | [Vendure](https://github.com/vendurehq/vendure) | Learn **NestJS** structure — natural upgrade from Express |
| **3** | [Better Auth](https://github.com/better-auth/better-auth) | Deepen auth after your `protect` middleware |
| **4** | [Ghost](https://github.com/TryGhost/Ghost) | Mature Node patterns, long-term maintainability |
| **5** | [PostHog](https://github.com/PostHog/posthog) | Scale, ingestion, feature flags — when you think about production traffic |
| **6** | [Medusa](https://github.com/medusajs/medusa) or [Strapi](https://github.com/strapi/strapi) | Modular monorepo architecture |
| **7** | [google-cloud-node](https://github.com/googleapis/google-cloud-node) | When you deploy to GCP |
| **8** | [n8n](https://github.com/n8n-io/n8n) | When you want background jobs / integrations at scale |

---

## Clone & first-hour checklist

```bash
# Example: Cal.com (read their README for exact requirements)
git clone https://github.com/calcom/cal.com.git
cd cal.com
# Install Node 18+, PostgreSQL, yarn — follow repo README
```

**First hour tasks:**

- [ ] Read `README.md` and `LICENSE`
- [ ] Find main API entry (search `listen`, `NestFactory`, `createServer`)
- [ ] List middleware order (cors, json, auth, errors)
- [ ] Find one `POST` route and trace to DB
- [ ] Find global error handler / exception filter
- [ ] Find auth guard / JWT verify
- [ ] Check `.github/workflows` for CI
- [ ] Note `ee/` or `.ee.` files — what is commercial-only

**Journal template** (copy to your notes):

```markdown
## Repo: _______
- Entry file: 
- Middleware order: 
- Auth: 
- Errors: 
- ORM: 
- One thing to steal for Todo API: 
```

---

## What NOT to expect

| Myth | Reality |
|------|---------|
| “Google has a big Todo API clone” | Google ships **SDKs**, not CRUD tutorial apps |
| “All YC repos are MIT” | Check license — AGPL, fair-code, EE folders common |
| “Stars = easy to read” | 40k stars often = **huge monorepo** — start with one package |
| “Copy-paste into Todo API” | Patterns differ (Prisma vs Mongoose, Nest vs Express) — **learn ideas**, not lines |
| “Open source = free for any commercial use” | Read license — n8n, Directus, Cal.com EE have restrictions |

---

## Links quick reference

### Next pick — depth on your topics

| Project | GitHub | Stack | Role |
|---------|--------|-------|------|
| Habitica | https://github.com/HabitRPG/habitica | JS, Express, Mongoose | Closest twin to your codebase |
| NodeBB | https://github.com/NodeBB/NodeBB | JS, Express, multi-DB | Hardest Node problems, plain Express |
| Medusa | https://github.com/medusajs/medusa | TS, Express core | Framework design + open PR path |
| Ghost | https://github.com/TryGhost/Ghost | JS/TS, Express-style | Content API vs Admin API split |
| express-rate-limit | https://github.com/express-rate-limit/express-rate-limit | TS | Deep read of a middleware you ship |
| Fastify | https://github.com/fastify/fastify | JS, own framework | Not Express — contrast read, `lib/` is 34 files |
| BullMQ | https://github.com/taskforcesh/bullmq | TS, Redis/Postgres | Not an app — queues, locks, retries in 52 Lua scripts |

### Tier 1 — Start here

| Project | GitHub | Website |
|---------|--------|---------|
| Cal.com | https://github.com/calcom/cal.com | https://cal.com |
| PostHog | https://github.com/PostHog/posthog | https://posthog.com |
| Vendure | https://github.com/vendurehq/vendure | https://vendure.io |
| Ghost | https://github.com/TryGhost/Ghost | https://ghost.org |

### Y Combinator

| Project | GitHub | YC page |
|---------|--------|---------|
| Better Auth | https://github.com/better-auth/better-auth | https://www.ycombinator.com/companies/better-auth |
| Mastra | https://github.com/mastra-ai/mastra | https://www.ycombinator.com/companies (W25) |
| PostHog | https://github.com/PostHog/posthog | https://www.ycombinator.com/companies/posthog |
| Tambo | https://github.com/tambo-ai/tambo | https://tambo.co |

### Google

| Project | GitHub |
|---------|--------|
| Google Cloud Node clients | https://github.com/googleapis/google-cloud-node |
| Functions Framework | https://github.com/GoogleCloudPlatform/functions-framework-nodejs |
| Google APIs Node client | https://github.com/googleapis/google-api-nodejs-client |

### Large platforms

| Project | GitHub |
|---------|--------|
| Strapi | https://github.com/strapi/strapi |
| Directus | https://github.com/directus/directus |
| Medusa | https://github.com/medusajs/medusa |
| n8n | https://github.com/n8n-io/n8n |
| Appwrite | https://github.com/appwrite/appwrite |
| Outline | https://github.com/outline/outline |
| Payload CMS | https://github.com/payloadcms/payload |
| Novu | https://github.com/novuhq/novu |

### License & business model reading

| Topic | URL |
|-------|-----|
| Open core | Search "open core model" + project `ee/LICENSE` |
| Fair-code | https://faircode.io |
| n8n Sustainable Use License | https://docs.n8n.io/privacy-and-security/sustainable-use-license/ |
| Cal.com licensing | https://github.com/calcom/cal.com (README — AGPL vs EE) |
| OSI definition | https://opensource.org/osd |

---

## Connect back to this Todo API project

When reading any repo above, ask:

1. **Where would my `GET /tasks` live?**
2. **How do they return 400 vs 404 vs 409?** (compare to your `app.js` global handler)
3. **How is rate limiting applied?** (compare to `middleware/rateLimit.js`)
4. **How do they test APIs?** (Supertest, e2e — your `todo.md` #24)
5. **What happens on deploy?** (env vars, health check, migrations)

Add discoveries to [`learn.md`](learn.md) or ask in chat — same step-by-step style as dotenv, CORS, and rate limiting.

---

> **How to use this file:** Pick **one repo** from [Recommended study order](#recommended-study-order-for-you), clone it, complete the [first-hour checklist](#clone--first-hour-checklist), and compare one auth route + one CRUD route to your Todo API.
