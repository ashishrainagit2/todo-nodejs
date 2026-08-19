# Error handling — notes from 19 Aug 2026

Q&A while experimenting with `/health`, `AppError`, `normaliseError`, Express 5, and the default HTML error page. This repo is **Express 5.2**.

Related code: `app.js` (dotenv, 404, `normaliseError`, 4-arg handler), `utils/AppError.js`, `controllers/auth.js`.

---

## 1. Does Express catch errors without try/catch?

**Yes, on Express 5** — for a `throw` and for a rejected `await` inside a route/middleware.

Express catches it and **calls** the first 4-arg function `(err, req, res, next)`. That function does not wrap your routes; it only runs after Express has already decided “this is an error.”

`try/catch` + `next(e)` is the same handoff, written by you. On Express 5 you can skip it on `async` controllers and still land in the global handler.

Still **not** caught (even on 5):

- Errors after the handler has returned (`setTimeout`, a callback you never `await`)
- Errors outside a request (boot, `mongoose.connect`, `unhandledRejection`)
- You already sent `res.json(...)` then throw — headers are gone

---

## 2. What does `next(e)` do? (`controllers/auth.js`)

`next(e)` is the **error** form of `next`. Express leaves the rest of the normal (3-arg) middleware chain and looks for `(err, req, res, next)`.

In this app that is the global handler in `app.js`. It is not “the next line after `login`.” The 404 middleware is `(req, res, next)` — three args — so Express skips it.

| Call | Meaning |
|------|---------|
| `next()` | keep going down the **success** chain |
| `next(e)` | jump to the **error** chain. `e` becomes `err` |

On Express 5, `throw` / rejected `await` inside an `async` handler does that jump anyway. `catch (e) { next(e) }` is the explicit version. You still need that pattern if you catch in order to **change** the error first (`next(new AppError(...))`), which `protect` does for a bad JWT.

---

## 3. Experiment: `throw new Error('test error')` on `GET /health`

Plain `Error`, not `AppError`. `normaliseError` does not recognize it. The 4-arg handler treats it as a **bug**:

| Field | Why |
|-------|-----|
| `success: false` | always, for errors |
| `status: 500` | unknown → hardcoded 500 |
| `message: "Something went wrong"` | client must not see `"test error"` |
| `stack` | only when `NODE_ENV !== 'production'` |

Express **did** catch the throw with no try/catch. It did **not** copy `e.message` into the body. Operational errors (`AppError`) are safe to show; random `Error`s are not.

To see your own text: `throw new AppError('test error', 500)`.

`SendStream.error` in the stack is not a second bug. `express.static('public')` is mounted **above** `/health`. `GET /health` first looks for a file `public/health`, misses, then the route runs.

Server log: `Unhandled error ===>` with the real `Error: test error` — that copy is for you, not the client.

---

## 4. What is `AppError`?

Not only “wrong input.” It is anything you **meant to tell the client**. The app is fine; **this request** cannot succeed.

| Kind | Example | Status |
|------|---------|--------|
| Bad input | invalid email, `page=-1` | 400 |
| Missing resource | task not found, unknown route | 404 |
| Auth | no token, bad JWT, wrong password | 401 |
| Forbidden | CORS origin blocked | 403 |
| Conflict | email already registered | 409 |

Rule of thumb: if the client can change the request and succeed, it should be an `AppError`. If *you* have to fix the code or the server, leave it a plain `Error` → 500.

`utils/AppError.js`: `isOperational = true` marks the message as written for the client.

---

## 5. What is `normaliseError`?

A **translator**, not a catcher. It runs *inside* the 4-arg handler, after Express has already handed you `err`.

The handler only knows two buckets: `AppError` (safe to show) vs everything else (bug → 500 + `"Something went wrong"`). Libraries do not throw `AppError`. `normaliseError` maps the ones you **expect** so they are not treated as crashes.

It does **not** look at status 500 and then decide. It looks at **what kind of object** `err` is. Library errors are not 500s yet. They become 500 only if they are not matched, because the handler’s default bucket is “unknown → 500.”

| Incoming `err` | What `normaliseError` does |
|----------------|----------------------------|
| already `AppError` | pass through, no change |
| Mongoose `ValidationError` | wrap as `AppError` 400, per-field messages |
| Mongoose `CastError` | wrap as `AppError` 400, bad id |
| duplicate key `11000` / `11001` | wrap as `AppError` 409, email taken |
| `express.json()` parse fail (`entity.parse.failed`) | wrap as `AppError` 400, malformed JSON |
| anything else (`Error: test error`) | pass through → handler makes it 500 |

Without it, `User.create({ email: 'not-an-email' })` would still be a Mongoose error, so the client would get 500 `"Something went wrong"` even though that is a normal bad request.

---

## 6. Why a custom 4-arg handler if Express already has a default?

Express already **catches** the error. You replaced **what the client gets**, not the catching.

Reasons: no HTML, one JSON shape, `normaliseError`, hide bug internals.

| Default Express handler | Ours |
|-------------------------|------|
| HTML page | JSON |
| message/stack depend on env | one shape: `success`, `status`, `message` |
| no idea what Mongoose is | `normaliseError` → 400/409 instead of 500 |
| leaks `"test error"` in dev | unknown bugs → `"Something went wrong"` |

Same format is the API contract: Postman, a frontend, and `/api-docs` can all rely on `{ success: false, status, message }`. An HTML `<pre>` is useless to `fetch()`.

---

## 7. Experiment: comment out the 4-arg handler

You get Express’s **default** page (`finalhandler`):

**Development** (`NODE_ENV` unset or not `production`):

```html
<title>Error</title>
<pre>Error: test error
    at ...app.js:77:11
    ...full stack...</pre>
```

**Production** (`NODE_ENV=production`):

```html
<title>Error</title>
<pre>Internal Server Error</pre>
```

Switch: `NODE_ENV`. Express copies it into `app.get('env')` **when `express()` runs**. It never looks at `process.env.NODE_ENV` again.

Changing `.env` alone is not enough if:

1. Nodemon does not restart on `.env` (it watches `js,json`, not `.env`). Restart with `rs`.
2. `require('dotenv/config')` runs **after** `express()` — the snapshot is already `development`.

That was this file’s original trap:

```js
const app = express();        // reads NODE_ENV now — dotenv not loaded → "development"
require('dotenv/config');     // too late for app.get('env')
```

`isProduction` (after dotenv) would have been true, so the **custom** handler would have hidden the stack. The **default** HTML page uses the frozen `app.get('env')` from `express()`.

Fix: dotenv **first**, then `express()`. Current `app.js` line 1.

---

## 8. Must dotenv always be above Express? Industry standard?

Not “always above Express.” Always **before anything that reads `process.env` at load time.** `express()` happens to snapshot `NODE_ENV`.

dotenv is a **dev helper**, not a production standard. In prod the platform already injects env before `node app.js`, so line order would not have bitten you on a VPS.

| Where env comes from | Typical use |
|----------------------|-------------|
| Platform / systemd / Docker / k8s | production — no dotenv |
| Node `--env-file=.env` (20+) | local, no library |
| `require('dotenv/config')` first in the **entry** file | local/dev |

```js
require('dotenv/config'); // first
const express = require('express');
const app = express();
```

---

## 9. Async errors without try/catch?

On **Express 5**, a rejected `await` in an `async` handler is treated like a `throw`. Forwarded to the 4-arg handler. No `try/catch` required.

```js
exports.login = async (req, res) => {
  const user = await User.findOne({ email: req.body.email }); // rejects → error handler
};
```

| | Express 4 | Express 5 (this repo) |
|--|-----------|------------------------|
| `throw` in sync handler | caught | caught |
| rejected `await` in async | **not** caught — hanging request + `unhandledRejection` | caught, same as `throw` |
| `try/catch` + `next(e)` | required for async | optional, same result |

Still **not** caught on 5 if Express is not waiting on that promise:

```js
// missing await — handler looks finished
User.findOne({ email }).then((u) => { throw new Error('nope'); });

setTimeout(() => { throw new Error('too late'); }, 0);
```

Those become `unhandledRejection` / `uncaughtException`.

Keep `try/catch` when you want to **translate** (bad JWT → `AppError` 401). Drop it on `async` controllers and Mongoose / `bcrypt.compare` failures still land in the JSON handler.

---

## 10. “Express is not waiting on that promise” — crash, default handler, try/catch?

Express only follows **the promise the handler returns**. An `async` function returns a promise that settles when the function hits `return` / the last `await`. Anything you kick off **without** `await` or `return` is a stray. Express thinks the request is done.

Temporary lab: `GET http://localhost:3005/error-lab?case=sync|await|float|timeout` (in `app.js`). `/health` is a real health check again.

| `?case=` | What happens | Express 4-arg / default HTML? | Process? |
|----------|----------------|-------------------------------|----------|
| `sync` | `throw` in the handler | **Yes** — JSON (or default HTML if 4-arg is commented out) | stays up |
| `await` | `await Promise.reject(...)` | **Yes** — Express 5 treats it like `throw` | stays up |
| `float` | `Promise.reject` with no `await`; we send 200 first | **No** — request already finished | `unhandledRejection`. Node 15+ default is throw → process **exits**. Nodemon restarts. |
| `timeout` | `throw` inside `setTimeout`; we send 200 first | **No** | `uncaughtException` → process **exits**. Nodemon restarts. |

**Will it restart and drop all users?** For `float` and `timeout`, **this Node process dies**. Every in-flight request on that process is cut. Nodemon / PM2 start a new process; clients must retry. In `server.js` cluster mode only **one worker** dies; the others keep serving. That is why fire-and-forget is worse than a 500: a 500 is one client; an uncaught exception is everyone on that process.

**Will Express default catch them?** No. Default HTML and your 4-arg handler only run for errors that happen **while Express still owns the request**. After `res.json`, or after the handler returned without awaiting, Express has moved on. Node’s process events own it after that.

**Shall I put try/catch in those?** Not around the handler as a whole — that does not catch a later tick.

```js
try {
  Promise.reject(new Error('nope')); // does not throw now
} catch (e) { /* never runs */ }

try {
  setTimeout(() => { throw new Error('nope'); }, 0);
} catch (e) { /* never runs — throw is inside the timer */ }
```

What actually works:

| Pattern | Fix |
|---------|-----|
| DB / bcrypt / fetch | `await` it (or `return` the promise). Express 5 + 4-arg handler is enough. |
| Must use `.then` | `return User.findOne(...).then(...)` so Express waits, **or** `.catch(next)` |
| Timer / background work | do not `throw`. `console.error` / a logger. The HTTP request is already over. |
| try/catch inside the timer | catches the throw so the **process** lives, but you cannot send a new JSON body if `res` was already used |

The real rule: do not start work the request handler forgets about. `try/catch` is for translating errors you **await**. It is not a net under fire-and-forget.

---

## 11. Why `sync` / `await` lived, and `float` / `timeout` killed the process

`sync` and `await` failed **while Express still had the request**. `float` and `timeout` failed **after** Express had finished. Only Node saw those — and Node’s default is to **exit**.

**“Express only watches the promise the handler returns”**

The lab route is `async`. Calling it always returns **one** promise. Express 5 does the equivalent of:

```js
Promise.resolve(handler(req, res, next)).catch(next);
```

That is the **only** promise it `.catch`es. It does not watch every promise in the process.

- That promise **rejects** → `next(err)` → JSON 500. Process stays up.
- That promise **fulfills** (you `return res.json(200)`) → Express is done. A later reject/throw is Node’s problem.

`await` is the join: it makes the inner failure become the **handler’s** failure. Without it you have two timelines. Express only bought a ticket for one of them.

```js
Promise.reject(new Error('lab: floating reject')); // a *second* promise — forgotten
return res.json({ ... });                           // handler promise succeeds with 200
```

A tick later the orphan rejects → `unhandledRejection` → process dies.

`timeout`: `throw` is inside a timer callback, not inside the handler. `uncaughtException` → process dies.

| case | Which failure? | Who is listening? | Result |
|------|----------------|-------------------|--------|
| sync | the async function’s own promise (`throw`) | Express | JSON 500 |
| await | same (`await` joins the inner reject) | Express | JSON 500 |
| float | a **different** promise, not awaited | nobody / Node | process die |
| timeout | `throw` on another tick | nobody / Node | process die |

One forgotten `await` can crash the **whole process**, not one request. Every in-flight client on that process is dropped. Nodemon restarts it. Cluster: one worker dies.

---

## 12. `try/catch` around the lab — it still crashes if you forget `await`

The lab handler is now wrapped in `try/catch` on purpose. Hit the same URLs again and watch the **nodemon terminal**.

```
GET http://localhost:3005/error-lab?case=sync
GET http://localhost:3005/error-lab?case=await
GET http://localhost:3005/error-lab?case=float
GET http://localhost:3005/error-lab?case=timeout
```

`try/catch` only sees errors that throw **on the current stack**, inside that `try`, **now**.

| `?case=` | Terminal | Postman | Process |
|----------|----------|---------|---------|
| sync | `LAB CATCH RAN ===> lab: sync throw` | JSON 500 | lives |
| await | `LAB CATCH RAN ===> lab: awaited reject` | JSON 500 | lives |
| float | `LAB try finished for float — catch did not run` then crash. **No** `LAB CATCH RAN` | 200, then connection dies | **dies** |
| timeout | `LAB try finished for timeout — catch did not run` then crash. **No** `LAB CATCH RAN` | 200, then dies | **dies** |

Why `float` ignores try/catch: `Promise.reject(...)` does **not throw now**. It schedules a rejection. The `try` block finishes successfully, you send 200, `catch` never ran. Next tick: orphan rejects, no `.catch` on **that** promise → crash.

Picture: `try/catch` is a net on the floor of **this room**. `await` carries the falling object into this room. Forget `await` and it falls in the hallway **after you locked the door**. Putting a bigger net in the room does nothing.

```js
try {
  Promise.reject(new Error('forgot await')); // does not throw now
} catch (e) { /* never runs */ }

try {
  setTimeout(() => { throw new Error('timer'); }, 0);
} catch (e) { /* never runs — throw is inside the timer */ }
```

What actually prevents the crash:

| Pattern | Fix |
|---------|-----|
| DB / bcrypt / fetch | `await` it (or `return` the promise) |
| `.then` without await | `return` that chain, or `.catch(next)` |
| Timer / background | do not `throw`; log |

`try/catch` + `await` together is fine (`await` case). `try/catch` **instead of** `await` is not. One missing `await` skips the catch and can still take down the server.

Also: `GET http://localhost:3005/error-lab?case=early` — forgotten `await` on a promise that **succeeds**. 200 immediately; ~1.5s later the terminal logs success; process stays up. Same mistake as `float`; the promise **resolves**, so nothing is unhandled.

---

## 13. When I forget `await`, why doesn't `catch` run? Why is Express done?

Two clocks. `try/catch` and Express only live on **clock 1**. Forgot `await` puts the error on **clock 2**.

**Why `catch` does not run**

`try/catch` catches a **throw**. `Promise.reject(...)` without `await` does **not throw**. It creates a promise object. That line is a successful line of JavaScript.

```js
try {
  Promise.reject(new Error('boom')); // line OK — you only *created* a promise
  res.json({ ok: true });            // still inside try, still success
} catch (e) {
  // only if something THREW. Nothing threw.
}
```

`await` is what **turns a rejection into a throw**:

```js
await Promise.reject(new Error('boom'));
//  ↑ pauses this function until that promise settles
//    reject → this line throws → catch runs
```

No `await` → this function never pauses → never throws → `catch` has nothing to catch. The rejection is attached to **that other promise**, which you dropped.

**Why Express is done**

Express waits on **one** thing: the promise that `async (req, res) => { ... }` **returns**. That promise succeeds when the function **returns** without throwing.

Timeline for `float`:

```
Tick 1 (handler is running)
  Promise.reject(...)     // started a second promise, ignored it
  res.json(200)           // HTTP response sent
  return                  // async function finished SUCCESSFULLY
  → Express: handler promise fulfilled. I am done. No next(err).

Tick 2 (handler is gone)
  that second promise rejects
  → Express is not in this stack
  → catch is not in this stack
  → Node: unhandledRejection → process can exit
```

Forgot `await` = you started work and **declared the request finished** before that work failed. `catch` only wraps the declare-finished part. The failure arrives after the wrapping is over.

**In short:** one forgotten `await` on a promise that **later rejects** can crash the whole Node process. Forgotten `await` on a promise that **succeeds** (`?case=early`) does not crash — you just answered too soon.

---

## 14. Forgot `await` on `fetch` — does an API failure crash the server?

Only if that `fetch` **promise rejects**.

| What happened to fetch | Promise | Crash? |
|------------------------|---------|--------|
| Network down, DNS, connection reset | **rejects** | yes, if no await / `.catch` |
| HTTP 404 / 500 / 401 | **resolves** | no — fetch treats that as a normal response (`response.ok === false`) |
| `r.json()` on empty/bad body | that part rejects | yes, if you chained it and forgot await |

`fetch` does **not** reject just because the other API returned 500. Crash is: **unhandled reject** (network, abort, or a later `.json()`), not “the remote status code was 500.”

---

## 15. Industry standards (not a bigger `try/catch`)

| Layer | What people actually do |
|-------|-------------------------|
| Write the code | `await` every promise you care about. ESLint: `no-floating-promises` / `require-await` so CI fails on a missing await |
| Express 5 | `async` handler + global 4-arg handler. Awaited rejects become JSON 500, process lives |
| Background work (queue, timer, fire-and-forget) | explicit `.catch(err => log(err))`. Do not throw. Do not assume Express is still there |
| Process | listen for `unhandledRejection` / `uncaughtException`, **log, then exit**. Let PM2 / systemd / k8s start a fresh process. Do not swallow and keep serving — the app is in an unknown state |
| Node flag | default (15+) already throws on unhandled rejection. Some use `--unhandled-rejections=strict` |

Nobody relies on a giant `try/catch` as a net for forgotten awaits. Standard: **don’t leave floating promises**; if one still escapes, **crash and restart**.

---

## 16. Event loop — and why async is “outside the immediate flow”

Sync work happens **now, on this request, on this stack**. Async I/O does not.

```js
const n = 1 + 1;
throw new Error('boom'); // same line, same request — try/catch and Express are still there
```

When you reach a database, `fetch`, or disk, Node **offloads** that to the OS / driver and moves on. The event loop is free to handle the **next** request. Execution left the original call stack.

```js
app.get('/tasks', async (req, res) => {
  const tasks = await Task.find({ userId: req.user._id });
  res.json(tasks);
});
```

```
1. Handler starts.
2. Task.find(...) — Node does not sit on your thread. It asks Mongo: ping me when done.
3. await pauses THIS function. Event loop is free — POST /login can run in that gap.
4. Mongo answers. Node resumes this function after the await.
5. res.json(tasks).
```

`await` is a bookmark: “when that outside work finishes, come back **here**.”

- Bookmark + failure → comes back into this function → throw / catch / Express.
- No bookmark → handler returns now, Express is done, Mongo’s answer (or reject) arrives later with nobody waiting (`early` vs `float`).

**Event loop in one picture**

The event loop is Node’s **dispatcher**. One thread, one “now.” It does not run the Mongo query. It only decides **what runs next** when the current bit of JS finishes.

JS never runs two functions at the same instant. I/O: Node tells the OS “do this,” then the loop can pick another waiting piece of work.

```
Time →

GET /tasks          POST /login
─────────────       ─────────────
start handler
Task.find(...)      (waiting)
await  → pause
                    start handler
                    bcrypt.compare...
                    res.json(token)
                    done
Mongo says “here”
resume /tasks
res.json(tasks)
```

`/tasks` did not freeze the server. `await` handed control **back to the event loop**. The loop saw `/login` ready and ran it. Later Mongo completed; the loop put `/tasks` back on the plate.

The loop tracks timers, finished I/O, and “this `async` function can continue after `await`.” It does **not** sit inside `Task.find`. When work finishes, a note lands in the inbox: resume this function, or reject this promise.

Forgot `await`: you hung up before the other office called back. The receptionist (event loop) still gets the callback — but nobody is on the line (`float` → crash if it rejects).

---

## 17. `AppError` vs Express default vs `normaliseError`

`AppError` (`utils/AppError.js`) does **not** change Express’s default HTML handler. It is a custom `Error` with extra fields (`statusCode`, `errors`, `isOperational`). Express only **forwards** the object. Your **4-arg** handler is what replaced the HTML page.

```
throw / next(err)
        ↓
Express (not the HTML default — you mounted a 4-arg handler)
        ↓
normaliseError(err)
  already AppError     → leave it
  Mongoose / bad JSON  → wrap in new AppError(...)
  unknown              → leave as plain Error
        ↓
4-arg handler
  AppError → statusCode + message (+ errors) as JSON
  else     → 500 "Something went wrong"
```

`normaliseError` does not “use AppError to talk to Express.” It **turns library errors into AppError** so the handler can treat them like the ones you threw on purpose.

---

## 18. `Error.captureStackTrace(this, this.constructor)`

In `utils/AppError.js`:

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

V8 fills `error.stack`. By default the first frames are **inside** `new AppError(...)` — `AppError.constructor`, `super(message)`. That is noise when you are debugging *where you threw*.

The second argument means: **omit this constructor** from the stack. The first useful line becomes the `throw new AppError(...)` in the controller.

**Example** — `controllers/auth.js` login throws invalid credentials:

```js
throw new AppError('Invalid credentials', 401);
```

Without `captureStackTrace`:

```
Error: Invalid credentials
    at new AppError (utils/AppError.js:5:9)
    at exports.login (controllers/auth.js:33:19)
    at Layer.handleRequest (...)
```

Line `AppError.js:5` is `super(message)` / the constructor. You already know you constructed an `AppError`. It does not tell you *why* the request failed.

With `Error.captureStackTrace(this, this.constructor)`:

```
Error: Invalid credentials
    at exports.login (controllers/auth.js:33:19)
    at Layer.handleRequest (...)
```

First frame is the `throw` site. Same error object, cleaner `.stack` when you `console.error` it locally.

It does **not** change the JSON the client sees. `statusCode` / `message` / `errors` are unchanged. It only edits where `.stack` starts.

---

## 19. Machine-readable `code` on `AppError`

HTTP status and `message` were not enough. 400 covers many cases. `message` is for humans and will change (copy, i18n). A frontend must not do `if (message.includes('invalid'))`.

`code` is a **contract**. It does not change when the English changes.

Constructor (`utils/AppError.js`):

```js
constructor(message, statusCode = 500, errors = [], code = 'ERR_GENERIC')
```

JSON from the 4-arg handler always includes `code`. Known `AppError` uses `error.code`. Unknown bugs use `ERR_INTERNAL` (still no details in production).

```json
{
  "success": false,
  "status": 401,
  "message": "Invalid credentials",
  "code": "ERR_INVALID_CREDENTIALS"
}
```

Frontend: `if (err.code === 'ERR_INVALID_CREDENTIALS') showLogin()`.

| code | When |
|------|------|
| ERR_VALIDATION | bad body / page / limit / ids / tasks |
| ERR_INVALID_ID | malformed ObjectId |
| ERR_MALFORMED_JSON | broken JSON body |
| ERR_NO_UPDATE_FIELDS | PATCH with nothing to change |
| ERR_BULK_LIMIT | too many tasks in one bulk create |
| ERR_TASK_NOT_FOUND | task missing or not yours |
| ERR_ROUTE_NOT_FOUND | unknown URL |
| ERR_NO_TOKEN | no Bearer token |
| ERR_INVALID_TOKEN | bad / expired JWT |
| ERR_USER_GONE | user id in token no longer exists |
| ERR_INVALID_CREDENTIALS | login failed |
| ERR_EMAIL_TAKEN | register duplicate email |
| ERR_CORS | origin not allowed |
| ERR_RATE_LIMIT | 429 |
| ERR_INTERNAL | unexpected 500 |
| ERR_GENERIC | constructor default if you omit `code` |

Lab: `GET /error-lab?case=stack` still uses default `ERR_GENERIC` on `new AppError('demo', 400)`.

### Do we store these codes anywhere?

**Not in Mongo.** They are part of the API, like status codes — not user data.

**Today** they are string literals at each `throw new AppError(..., 'ERR_TASK_NOT_FOUND')`. Fine for a small app. Risk: typo (`ERR_TASK_NOTFOUND`) and the client never matches.

**Usual next step** (industry, when the list grows or a frontend shares it):

| Place | Role |
|-------|------|
| `utils/errorCodes.js` (or `constants/errors.js`) | one object `ERROR_CODES.TASK_NOT_FOUND` used by server throws. Typos fail at import |
| Swagger `Error.code` | public catalog for humans and codegen |
| Frontend | same strings, or generate from OpenAPI — **do not** invent a second meaning for the same code |

Do **not** invent a DB table of codes unless you are building a translation admin UI. The list belongs in **source + docs**, versioned with the API. Adding a code is a contract change: old clients ignore unknown codes; removing/renaming one is a breaking change.


