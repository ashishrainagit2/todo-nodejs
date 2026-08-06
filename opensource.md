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
5. [Tier 1 — Best for learning REST + auth + errors](#tier-1--best-for-learning-rest--auth--errors)
6. [Tier 2 — Y Combinator companies](#tier-2--y-combinator-companies)
7. [Tier 3 — Google open source (Node)](#tier-3--google-open-source-node)
8. [Tier 4 — Large commercial Node platforms](#tier-4--large-commercial-node-platforms)
9. [Tier 5 — Auth & identity (Node/TS)](#tier-5--auth--identity-nodets)
10. [Tier 6 — Commerce & CMS](#tier-6--commerce--cms)
11. [Tier 7 — Automation & workflows](#tier-7--automation--workflows)
12. [Tier 8 — Developer tools & BaaS](#tier-8--developer-tools--baas)
13. [Recommended study order (for you)](#recommended-study-order-for-you)
14. [Clone & first-hour checklist](#clone--first-hour-checklist)
15. [What NOT to expect](#what-not-to-expect)
16. [Links quick reference](#links-quick-reference)

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
| **BullMQ** | [taskforcesh/bullmq](https://github.com/taskforcesh/bullmq) | Redis job queues for Node — used inside many commercial apps |

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
