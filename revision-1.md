# Revision Notes — 1

Every section below follows the same three parts:

1. **Package installed** — what to `npm install` (or "nothing, built in")
2. **Important code** — the lines that actually matter
3. **Logic** — why it exists and what it does

Suggested reading order (matches how a request flows)

- App bootstrap — `app.js`: middleware order, `express.json`, static, listen
- Security basics — Helmet, CORS, rate limit
- Logging + health — morgan, `/health`, DB readyState
- Routing layers — `routes/v1.js` → auth / task → controllers
- Auth — register/login, bcrypt, JWT, `protect` middleware
- Ownership — every task query scoped to `req.user._id`
- Mongoose — schemas, enums, ref, timestamps, unique email / indexes
- CRUD + queries — filters, sort allowlist, search, bulk create
- Validation + errors — field checks, `AppError`, global handler, Cast/11000
- API polish — `/api/v1`, Swagger/OpenAPI

---

## 0. Setup

### Package installed

```bash
# install Node.js first (gives you node + npm)
npm init            # creates package.json
npm install nodemon # restarts the server on every file save
npm install dotenv  # reads .env into process.env
```

### Important code

```json
// package.json
"type": "commonjs",
"scripts": {
    "start": "nodemon app.js",
    "start:debug": "nodemon --inspect app.js"
}
```

```js
// app.js — first line, before anything reads process.env
require('dotenv/config');
```

```text
.env            real secrets — never committed (listed in .gitignore)
.env.example    same keys, fake values — this one IS committed
```

### Logic

- `nodemon` is a dev tool only. In production the host runs `node app.js`.
- `require('dotenv/config')` must run **before** any file reads `process.env`,
  otherwise those values are `undefined`.
- `.env` holds `PORT`, `DB_CONNECTION`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
  `CORS_ORIGIN`, `RATE_LIMIT_*`.
- `.env.example` exists so another developer knows which keys to create
  without ever seeing your secrets.

---

## 1. Creating a server

### Package installed

```bash
    npm install express
```

- Latest version is **express 5.2.1**
- `package.json` has `"type": "commonjs"`

### Important code

```js
    const express = require('express');
const app = express();

app.listen(process.env.PORT || 3005, () => {
    console.log(`server running on port ${process.env.PORT}`);
});
```

### Logic

- `express()` creates the app object — a stack of middleware plus a router.
- `app.listen` binds the port and starts accepting TCP connections.

> ⚠️ **Correction to my earlier note:** the `app.listen` callback takes **no arguments** — not `(req, res)`. It fires once when the server starts listening, not per request. Writing `(req, res)` there looks harmless but is misleading.

---

## 2. Versioning

### Package installed

Nothing — plain express routing.

### Important code

**Before — no version prefix**

```js
const TaskRoutes = require('./routes/task');

app.use('/tasks', TaskRoutes);
```

And `routes/task.js` declares routes like:

```js
router.get('/', getTasks);
```

**After — with versioning**

```js
// 1. create the prefix
const V1_PREFIX = '/api/v1';

// 2. point at the version's route file
const v1Routes = require('./routes/v1');

// 3. mount it
app.use(V1_PREFIX, v1Routes);
```

```js
// routes/v1.js — everything the v1 contract covers
router.use('/tasks', apiLimiter, TaskRoutes);
router.use('/auth', authLimiter, AuthRoutes);
```

### Logic

- **Before:** whenever the URL starts with `/tasks`, go to `TaskRoutes`, which
  checks the rest of the path and sends it to the right controller.
- **After:** whenever the URL starts with `/api/v1`, go to `routes/v1.js`.
  Inside, it checks which route it is and forwards to the same routers as before.
- Adding `/api/v2` later is one more mount plus one more file — no edits
  scattered across route files, and both versions can run side by side while
  clients migrate.
- Route files never write the prefix themselves, so they stay reusable.

> It's just **one extra routing layer** between `app.js` and the original routers.

---

## 3. Important middlewares for APIs

### Package installed

Nothing — all three ship inside express.

### a. `express.json()`

```js
app.use(express.json());
```

**What it does, in order:**

1. Checks whether the `Content-Type` is `application/json` — skips entirely if not
2. Collects the incoming chunks into a buffer, enforcing a size limit (**100kb** by default)
3. Runs `JSON.parse` on the result
4. Assigns the parsed object to `req.body`
5. Calls `next()` so the route runs

So `POST /api/v1/tasks` with `{"title":"Buy milk"}` arrives as bytes, and by the time `createTask` runs, `req.body.title` is the string `"Buy milk"`.

Without the middleware `req.body` is `undefined`, and `const { email, password } = req.body` throws a `TypeError` — a 500, not a helpful 400. That's exactly why the auth controller reads `req.body ?? {}` and `validateTaskBody` guards with `typeof body === 'object'`.

#### Three consequences that show up in practice

- **The `Content-Type` check is a real gotcha.**
  If a client sends a JSON string but forgets or mistypes the header, the middleware skips it and `req.body` stays `undefined` — so you get validation errors saying fields are missing, even though you can see them in the request. Nothing is broken; the parser just never ran.

- **Bad JSON becomes an error, not a crash.**
  If the bytes aren't valid JSON, `JSON.parse` throws and the middleware passes an error with `type: 'entity.parse.failed'` to `next()`. That's the case `normaliseError` catches in `app.js` and turns into `400 Malformed JSON in request body`.

- **The size limit is a security feature, not a nuisance.**
  Without a cap, someone posting a 2GB body would have the server buffer it into memory. When file uploads arrive you'd raise it deliberately, or route those through `multer` instead.

#### The name misleads

It only touches **incoming requests**. Turning a response into JSON is `res.json()` — a completely separate mechanism.

> **Requests in, responses out.**

---

### b. `express.urlencoded({ extended: true })`

```js
app.use(express.urlencoded({ extended: true }));
```

Parses the body and puts the result on `req.body` — same job as `express.json()` but for a different encoding.

#### "Form data" is two different things

| Encoding | Handled by | Used when |
|----------|-----------|-----------|
| `application/x-www-form-urlencoded` | ✅ `express.urlencoded()` | A plain HTML `<form>` submits |
| `multipart/form-data` | ❌ needs **`multer`** | The form contains a file input, or JS uses `FormData` |

The urlencoded body looks like a query string:

```text
title=Buy+milk&status=pending
```

> `multipart/form-data` will matter when you get to attachments on tasks.

#### What `extended: true` changes

It chooses the parser:

- **`false`** → Node's built-in `querystring`, flat key-value pairs only
- **`true`** → the `qs` library, which understands bracket notation and builds nested structures

```text
user[name]=Ashish&tags[0]=work&tags[1]=urgent
→ { user: { name: 'Ashish' }, tags: ['work', 'urgent'] }
```

#### The trap: everything arrives as a string

There are no numbers, booleans or nulls in the wire format, so `completed=false` gives you the **string** `"false"` — which is **truthy** in JavaScript. JSON doesn't have this problem because it carries types.

Your validators would partly catch it (`readStringArray` rejects a non-array), but a boolean check would silently pass.

#### Status in this project

Effectively dead weight right now — every client sends JSON, so `express.json()` handles everything and `urlencoded` never fires. Harmless as a fallback; relevant the day something submits a real HTML form.

---

### c. `express.static('public')`

```js
app.use(express.static('public'));
```

Unlike the last two, this has nothing to do with `req.body` — it **serves files from disk** instead of running your code.

**The idea:** for each request it checks whether a matching file exists inside `public/`. If so it streams it back and stops. If not, it calls `next()` and the request continues to your routes and eventually the 404 handler.

#### The mapping — folder name is NOT in the URL

`public/` is the root:

```text
public/index.html    →  GET /              (index.html is the directory default)
public/style.css     →  GET /style.css
public/img/logo.png  →  GET /img/logo.png
```

#### What you get for free

- `Content-Type` inferred from the file extension
- `ETag` + `Last-Modified` handling, so repeat visits get `304 Not Modified` instead of the bytes
- `Range` support for video seeking

#### ⚠️ A real bug in that line

`'public'` resolves relative to **`process.cwd()`** — the directory you launched from — not relative to `app.js`. Run `npm start` from the project root and it works; run it from anywhere else and static serving silently stops.

Same trap already avoided for the log file with `path.join(__dirname, 'logs')`. The consistent fix:

```js
app.use(express.static(path.join(__dirname, 'public')));
```

#### Ordering

Static is mounted **above** the route mounts, so a file whose path collides with a route would win. Can't collide here since everything real lives under `/api/v1`.

#### Two things for later

- **Don't point static at an upload directory.** Serving user-uploaded files from your own origin means an uploaded `.html` executes as a page on your domain — that's stored XSS. Uploads go to S3 or a separate domain for exactly this reason.
- **In production, static assets usually don't come from Node at all.** nginx or a CDN serves them, because Node is comparatively slow at it and file streaming would compete with the API for the event loop.

---

## 4. Database connection

### Package installed

```bash
npm install mongoose
```

### Important code

```js
const mongoose = require('mongoose');

mongoose.connect(process.env.DB_CONNECTION)
    .then(async () => {
        console.log('Connected to database');

        const User = require('./models/user');
        try {
            await User.syncIndexes();   // builds the unique email index
            console.log('User indexes synced (unique email)');
        } catch (err) {
            console.error('User index sync failed — remove duplicate emails first:', err.message);
        }
    })
    .catch((err) => console.error('Database connection error:', err.message));
```

```text
DB_CONNECTION looks like mongodb://localhost:27017/todo-app
```

### Logic

- The original version was just `connect().then(log).catch(log)`. The
  `syncIndexes()` part was **added later**, with the unique email work — it is
  not part of connecting.
- `unique: true` in a schema is only an instruction. The index has to be built
  in MongoDB, and it fails if duplicate emails already exist. `syncIndexes()`
  runs at startup so that failure is printed once, loudly, instead of surfacing
  as a random duplicate later.
- Connecting is asynchronous, and `app.listen` does not wait for it. That is
  what `/health` is for — see §14.
- `mongoose.connection.readyState`: `0` disconnected, `1` connected,
  `2` connecting, `3` disconnecting.

---

## 5. Simple API without authentication and rate limiter

### Package installed

Nothing new — express + mongoose.

### Important code

```js
// routes/task.js
router.get('/', getTasks);
```

```js
// controllers/task.js
exports.getTasks = async (req, res, next) => {
    const tasks = await Task.find(filter).sort(sort);
    res.json(tasks);
};
```

```js
// models/task.js
const TaskSchema = mongoose.Schema({ /* fields */ }, { timestamps: true });
module.exports = mongoose.model('Task', TaskSchema);
```

### Logic

- Route `/api/v1/tasks` → `getTasks` controller.
- The route only maps a URL. The controller holds the business logic, talks to
  the database and sends the response.
- Before touching the database you need a model (`mongoose.Schema`). Mongoose
  provides the query methods — here `Task.find`.
- Mongoose turns the model name `'Task'` into the collection `tasks`
  (lowercased and pluralised).
- `{ timestamps: true }` gives `createdAt` and `updatedAt` for free.

---

## 6. Authentication (register and login) and authorization

### Package installed

```bash
npm install jsonwebtoken
npm install bcryptjs
```

### Important code

```js
// routes/auth.js
router.post('/register', register);
router.post('/login', login);
```

```js
// models/user.js — hash before the document is written
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});
```

```js
// controllers/auth.js — login
const match = await bcrypt.compare(password, user.password);

const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);
```

```js
// routes/task.js — every task route is protected
const { protect } = require('../middleware/auth');
router.use(protect);
```

```js
// middleware/auth.js
const token = req.headers.authorization.split(' ')[1];   // "Bearer xxx"

decoded = jwt.verify(token, process.env.JWT_SECRET);
// { userId: '6a7b...', iat: 1786455087, exp: 1787059887 }

const user = await User.findById(decoded.userId).select('-password');
req.user = user;   // hands identity to every controller
next();
```

### Logic

**Register**

- Check whether the email already exists (`User.findOne`) — business logic.
- If not, store it (`User.create`).
- The password is never stored raw. The `pre('save')` hook hashes it, so the
  controller never calls bcrypt itself.
- `isModified('password')` stops a second save (say, changing the role) from
  hashing the already-hashed value again.

**Login**

- `User.findOne` by email, then `bcrypt.compare(plain, hash)`.
- If both match, sign a JWT.
- MongoDB created `_id` at register time; login puts that `_id` inside the
  token. So decoding the token gives the user id back.

**Protect (authorization)**

- `jwt.verify` checks the signature against `JWT_SECRET` and the expiry. A
  tampered or expired token fails here → `401`.
- Verify only proves the token is genuine. `User.findById` then confirms the
  account still exists, and `select('-password')` keeps the hash out of memory.
- `req.user = user` is the trust boundary: from here on, controllers use
  `req.user._id` and never trust an id from the body or query.
- That is why ownership works — every task query is scoped with
  `{ userId: req.user._id }`, so one user can never read another's tasks.

> Anyone holding the token *is* that user — a bearer token. Keep `JWT_SECRET`
> long and secret, and keep expiry short.

---

## 7. CORS

### Package installed

```bash
npm install cors
```

### Important code

```js
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? parseOrigins(process.env.CORS_ORIGIN)
    : parseOrigins(process.env.CORS_ORIGIN_DEV);

app.use(cors({
    origin(origin, callback) {
        // Postman, curl, server-to-server — no Origin header
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new AppError('Not allowed by CORS', 403));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

### Logic

- CORS is a **browser** rule. The server just declares who is allowed; curl and
  Postman ignore all of it.
- `origin` as a function runs per request. `origin` is the site the request came
  from, checked against the allowlist from `.env`.
- `!origin` is allowed because non-browser clients send no `Origin` header at all.
- Failing with `AppError('Not allowed by CORS', 403)` instead of a plain `Error`
  means the global handler treats it as an expected error and returns a clean
  403, rather than logging it as a server bug and returning 500.
- `credentials: true` allows cookies / auth headers on cross-origin calls. It
  cannot be combined with `origin: '*'`, which is another reason for the allowlist.
- `methods` and `allowedHeaders` answer the **preflight** `OPTIONS` request.
  `Authorization` must be listed or every logged-in browser call fails.

---

## 8. Safe headers

### Package installed

```bash
npm install helmet
```

### Important code

```js
app.use(helmet());   // first middleware, so even 404s and errors carry the headers
```

### Logic

- Helmet sets a group of response headers that tell the browser to behave
  defensively. One line, roughly a dozen headers.
- The important ones:

```text
X-Content-Type-Options: nosniff        don't guess a file's type
X-Frame-Options: DENY                  can't be iframed → no clickjacking
Content-Security-Policy                what the page may load / execute
Strict-Transport-Security (HSTS)       HTTPS only, remembered by the browser
X-Powered-By removed                   stop advertising express
Referrer-Policy                        don't leak URLs to other sites
```

- They protect the **browser**, not the database. A JSON API still needs auth,
  validation and rate limiting.
- Mounted first on purpose, so error responses and 404s get the headers too.
- CSP is the strict one and it breaks pages that use inline scripts — which is
  exactly what happens with Swagger UI (see §12).

---

## 9. Error handling

### Package installed

Nothing — express has an error lane built in.

### Important code

```js
// utils/AppError.js
class AppError extends Error {
    constructor(message, statusCode, errors = []) {
        super(message);

        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;

        // drop the constructor call from the stack so it points at the throw site
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
```

```js
// app.js — 404, after every real route
app.use((req, res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});
```

```js
// app.js — turn known library errors into AppError. Anything else is a bug.
const normaliseError = (err) => {
    if (err instanceof AppError) return err;

    if (err.name === 'ValidationError') { /* mongoose → 400 per field */ }
    if (err.name === 'CastError')       { /* bad ObjectId → 400 */ }
    if (err.code === 11000)             { /* duplicate key → 409 */ }
    if (err.type === 'entity.parse.failed') { /* bad JSON → 400 */ }

    return err;   // unknown → programming error
};
```

```js
// app.js — global handler. 4 parameters is what makes it an error handler.
app.use((err, req, res, next) => {
    const error = normaliseError(err);
    const isKnown = error instanceof AppError;

    if (!isKnown) console.error('Unhandled error ===>', error);   // bug: log everything

    res.status(isKnown ? error.statusCode : 500).json({
        success: false,
        status: isKnown ? error.statusCode : 500,
        message: isKnown ? error.message : 'Something went wrong'
    });
});
```

### Logic

There are two kinds of errors in Node:

- **Operational errors** — expected, part of normal life: task not found, bad
  input, wrong password, rate limit hit. These get a real status code and a
  message the client can read. Every one of them is an `AppError`.
- **Programming errors** — bugs: a typo, a missing await, calling a method on
  `undefined`. The client gets a generic `500 Something went wrong`, and the
  full error goes to the server log. Leaking the message would leak file paths,
  queries and internals.

How an error reaches the handler:

- `throw new AppError(...)` inside an async controller, or `next(err)`.
- `next(err)` **skips all remaining normal middleware** and jumps straight to
  the error lane.
- Express recognises an error handler purely by its **4 parameters**
  `(err, req, res, next)`. Write 3 and it is treated as normal middleware and
  never sees errors.
- The error handler must be mounted **last**, after the routes and the 404.
- `try/catch` is still useful — not to keep the app alive, but to *translate*:
  catch a bcrypt or mongoose failure and rethrow it as an `AppError` with the
  right status.

Result: every failure in the app leaves through one door, in one shape.

```json
{ "success": false, "status": 404, "message": "Task not found" }
```

---

## 10. MVC and folder structure

### Package installed

Nothing — a convention, not a library.

### Important code

folder structure as below

```text
todo_api/
├── app.js                     entry point: middleware chain, mounts /api/v1, error handler
├── package.json
├── .env / .env.example        secrets and config (PORT, DB_CONNECTION, JWT_SECRET, CORS_ORIGIN)
│
├── models/                    M — schema + database shape
│   ├── user.js                userSchema, pre('save') password hashing
│   └── task.js                taskSchema, owner ref to User
│
├── controllers/               C — business logic, talks to models, sends response
│   ├── auth.js                register, login (bcrypt + jwt.sign)
│   └── task.js                getTasks, createTask, updateTask, deleteTask
│
├── routes/                    URL → controller mapping
│   ├── v1.js                  /tasks and /auth mounted here with rate limiters
│   ├── auth.js                router.post('/register'), router.post('/login')
│   └── task.js                router.use(protect) then task CRUD routes
│
├── middleware/                runs between route and controller
│   ├── auth.js                protect — jwt.verify, loads req.user
│   ├── rateLimit.js           apiLimiter, authLimiter
│   └── validateObjectId.js    rejects bad :id before hitting mongo
│
├── utils/
│   └── AppError.js            custom operational error class
│
├── docs/
│   └── swagger.js             OpenAPI spec, served at /api-docs
│
├── public/                    V — static files served by express.static
│   └── index.html
│
└── logs/
    └── access.log             morgan request log
```

### Logic

how MVC maps here (an API has no real View — JSON is the view)

```text
Model      → models/       only knows data and validation, no req/res
Controller → controllers/  the only place with business logic
View       → JSON response (and public/ for static files)
```

request flow

```text
app.js → /api/v1 → routes/v1.js → routes/task.js → middleware (protect)
       → controllers/task.js → models/task.js → mongo → response
```

why split like this

- route file only answers "which URL"
- controller only answers "what to do"
- model only answers "how data looks"
- so a change in one layer does not touch the others, and errors from any layer
  land in the single error handler in `app.js`

---

## 11. Rate limiting

### Package installed

```bash
npm install express-rate-limit
```

### Important code

Applied inside the version file `routes/v1.js`

```js
router.use('/tasks', apiLimiter, TaskRoutes);
router.use('/auth', authLimiter, AuthRoutes);
```

```js
// middleware/rateLimit.js
const jsonLimitHandler = (req, res, next) => {
    next(new AppError('Too many requests, please try again later', 429));
};

exports.apiLimiter = rateLimit({
    windowMs,                                          // 15 min block
    max: Number(process.env.RATE_LIMIT_MAX) || 10,     // 10 requests per IP
    standardHeaders: true,                             // RateLimit-* headers
    legacyHeaders: false,                              // drop old X-RateLimit-*
    handler: jsonLimitHandler,                         // our 429 AppError
});
```

The limiter sits **before** the router, so a blocked request never reaches the
controller or the database.

### Logic

#### 5 methods (algorithms)

for all five examples the rule is the same: 10 requests per 15 minutes,
windows are 15:00–15:15, 15:15–15:30 and so on

**1. fixed window**

count requests per fixed clock block, eg 10 per 15 min. counter resets to 0
when the window ends. simple and cheap, but allows a burst at the edge.

```text
14:50  req 1..10   counter = 10, all allowed
14:52  req 11      counter still 10 → 429 blocked
15:00  new window  counter = 0
15:00  req 1..10   allowed again
```

the edge problem in the same example

```text
14:59  10 requests  allowed (window 14:45–15:00)
15:00  10 requests  allowed (window 15:00–15:15)
→ 20 requests in ~1 minute even though the rule says 10 per 15 min
```

**2. sliding window log**

store the timestamp of every request, on each new request drop the timestamps
older than the window and count what is left. most accurate, no edge burst, but
memory grows with traffic.

```text
stored list for this IP:
[14:59:01 ... 14:59:10]        10 timestamps

15:00:05 new request arrives
  drop anything older than 14:45:05  → nothing dropped
  count = 10 → 429 blocked

15:14:20 new request arrives
  drop anything older than 14:59:20  → all 10 dropped
  count = 0 → allowed
```

so it never lets 20 through, but if one IP sends 5000 requests you store 5000
timestamps.

**3. sliding window counter**

middle ground, keeps small counters per sub-window and weights the previous
window instead of storing every timestamp. near accurate with far less memory.

```text
previous window 14:45–15:00 → 10 requests
current  window 15:00–15:15 → 2 requests so far
now is 15:03, so 80% of the current window still overlaps the previous one

estimate = 10 * 0.8 + 2 = 10    → 429 blocked
at 15:14 only 6% overlaps
estimate = 10 * 0.06 + 2 = 2.6  → allowed
```

two numbers per IP instead of a list of timestamps.

**4. token bucket**

bucket holds N tokens, refilled at a steady rate, each request takes one token,
empty bucket means reject. allows a short burst (saved up tokens) but limits the
average rate.

```text
bucket size 10, refill 1 token every 90 sec

start        tokens = 10
15:00:00     10 requests fired at once → all allowed, tokens = 0
15:00:05     req 11 → no token → 429 blocked
15:01:30     +1 token → 1 request allowed, tokens = 0
15:03:00     +1 token → 1 request allowed

idle for 15 min → bucket fills back to 10, burst allowed again
```

this is what most public APIs use — it forgives a quick burst from a normal user
but still caps the long run average.

**5. leaky bucket**

not token bucket flipped. requests enter a queue (the bucket). the queue **leaks**
at a fixed rate — one request processed every 90 sec, no faster. a burst of 10
does **not** all run at once: they line up and drip out. if the queue is already
full, the new request is 429.

```text
queue size 10, leak 1 request every 90 sec

15:00:00     10 requests arrive at once
             all 10 sit in the queue — none run together
             leak: 1 request every 90 sec
15:00:05     request 11 arrives → queue full → 429
15:01:30     request 2 processed (90 sec after the first)
15:03:00     request 3 processed

output is always smooth. the client that sent 10 at once waits.
```

| | token bucket | leaky bucket |
|---|---|---|
| what is stored | tokens (permission to go now) | queued requests |
| 10 at once, bucket full | all 10 run immediately | all 10 queue, drip out one by one |
| idle then busy | burst allowed (tokens saved up) | no burst — leak rate never changes |
| feels like | a generous public API | a traffic cop / message queue |

leaky bucket is how you shape traffic leaving a system (API gateways, a queue
in front of a slow DB). token bucket is how you allow a client a burst. this
project uses neither — `express-rate-limit` is **fixed window**.

#### which one is implemented here

**fixed window**, that is what `express-rate-limit` does by default with
`windowMs` + `max`.

```text
windowMs → how long one window lasts
max      → how many requests one IP gets inside that window
key      → client IP by default, so the count is per IP not global
handler  → instead of the default plain text 429, we call
           next(new AppError('Too many requests, please try again later', 429))
           so the 429 comes out in the same JSON shape as every other error
```

two limiters, because auth needs to be stricter

```text
apiLimiter  → all /tasks routes, normal usage
authLimiter → /auth routes, slows down brute-force login/register guessing
```

Limits are counted in memory, fine for one process. With multiple instances or
after a restart the counters reset, so production uses a shared store like Redis.

---

## 12. Swagger

### Package installed

```bash
npm install swagger-jsdoc swagger-ui-express
```

```text
swagger-jsdoc      reads the @openapi comments and builds one JSON spec
swagger-ui-express serves that JSON as the browser page
```

### Important code

Interactive API documentation. Instead of writing docs by hand, the docs are
generated from comments sitting next to the routes, so they cannot drift away
from the code. Three pieces:

**1. `docs/swagger.js` — the spec**

```js
const options = {
    definition: {
        openapi: '3.0.3',
        info: { title: 'Todo API', version: '1.0.0' },
        servers: [{ url: `http://localhost:${PORT}/api/v1` }],
        components,                      // schemas, responses, securitySchemes
        security: [{ bearerAuth: [] }]   // every route needs a token by default
    },
    apis: ['./routes/*.js']              // where to look for the comments
};

module.exports = swaggerJsdoc(options);
```

`components` is the reusable part, written once and referenced everywhere

```text
securitySchemes.bearerAuth  → the Authorize button, http + bearer + JWT
schemas.Task / TaskInput    → request and response body shape
schemas.Error               → { success, status, message, errors? }
responses.Unauthorized      → ready made 401 block
parameters.TaskId           → the :id path param
```

**2. `routes/*.js` — the per endpoint comment**

```js
/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create an account
 *     security: []                       # public, opt out of the global token
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Account created
 *       409:
 *         description: Email already registered
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/register', register);
```

**3. `app.js` — serve it**

```js
app.use('/api-docs', docsSecurityHeaders, swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        swaggerOptions: { persistAuthorization: true }  // keep pasted token on reload
    }));

// raw spec, for postman import or client generators
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
```

### Logic

- `$ref` means "use the shared piece from `components`", so changing the Task
  schema is one edit, not eight.
- The `servers` url already contains `/api/v1`, so route comments write
  `/auth/register`, not `/api/v1/auth/register`.
- `/api-docs` is mounted outside `/api/v1`, same as `/health` — it describes the
  server, not one API version.

**one gotcha — helmet CSP**

Swagger UI loads an inline script and inline styles; the global helmet CSP
blocks them and the page renders blank. The fix is to relax CSP **only on this
path**, not app wide.

```js
const docsSecurityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:']
        }
    }
});
```

**how to use it**

```text
open http://localhost:3005/api-docs
register → login → copy token → Authorize → paste
now protected task endpoints can be tried straight from the browser
```

> Note: the comments are documentation only, they do not validate anything. The
> real checks still live in the controllers and the model.

---

## 13. Validation

### Package installed

Nothing. Hand written in `controllers/task.js` — no `express-validator`, no Joi.
Mongoose (already installed) provides the last layer.

### Important code

**one reader per field, shared by create / update / bulk**

```js
const readText = (value, field, min, max, errors) => {
    // type check first, then measure the trimmed value — "  ab  " is 2 chars, not 6
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length < min || text.length > max) {
        errors.push({ field, message: `${field} must be a string between ${min} and ${max} characters` });
        return undefined;
    }
    return text;
};

const TASK_FIELD_READERS = {
    title:       (v, f, e) => readText(v, f, 3, 100, e),
    description: (v, f, e) => readText(v, f, 3, 1000, e),
    status:      (v, f, e) => readEnum(v, f, TASK_STATUSES, e),
    priority:    (v, f, e) => readEnum(v, f, TASK_PRIORITIES, e),
    dueDate:     (v, f, e) => readDate(v, f, e),
    tags:        (v, f, e) => readStringArray(v, f, ARRAY_FIELD_RULES.tags, e)
    // ...
};
```

**one validator, three modes**

```js
// partial: PATCH sends only changed fields, so missing ones are not errors
// prefix : bulk labels errors as "tasks[2].title"
const validateTaskBody = (body, { partial = false, prefix = '' } = {}) => {
    const errors = [];
    // a non-JSON request leaves req.body undefined — report a 400, not a crash
    const source = body !== null && typeof body === 'object' ? body : {};

    // catch client typos like "prioriy" instead of letting Mongoose drop them silently
    for (const key of Object.keys(source)) {
        if (!(key in TASK_FIELD_READERS) && !SERVER_OWNED_FIELDS.includes(key)) {
            errors.push({ field: key, message: `${key} is not an allowed field` });
        }
    }

    const value = {};   // only known, cleaned fields end up here

    for (const [field, read] of Object.entries(TASK_FIELD_READERS)) {
        if (!Object.hasOwn(source, field)) {
            if (!partial && REQUIRED_TASK_FIELDS.includes(field)) {
                errors.push({ field, message: `${field} is required` });
            }
            continue;
        }
        const parsed = read(source[field], field, errors);
        if (parsed !== undefined) value[field] = parsed;
    }

    return { errors, value };
};
```

**used in the controller**

```js
exports.createTask = async (req, res, next) => {
    const { errors, value } = validateTaskBody(req.body);

    if (errors.length > 0) {
        return next(new AppError('Validation failed', 400, errors));
    }

    const task = new Task({ ...value, userId: req.user._id });   // owner from the token
    const saved = await task.save();
    res.status(201).json(saved);
};
```

**ids are validated before they reach mongo**

```js
// middleware/validateObjectId.js
exports.validateObjectId = (param = 'id') => (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[param])) {
        return next(new AppError('Validation failed', 400, [
            { field: param, message: `${param} must be a valid task id` }
        ]));
    }
    next();
};
```

**the schema is the last line of defence**

```js
// models/task.js
status: { type: String, enum: ['not-started', 'pending', 'completed', 'in-progress'], default: 'not-started' }

// and on update
findOneAndUpdate(query, updates, { new: true, runValidators: true })
```

### Logic

**four layers, cheapest first**

```text
1. express.json()        is it even valid JSON, and under 100kb
2. validateObjectId      is :id a real ObjectId        → 400 before any query
3. validateTaskBody      business rules on the body    → 400 before any query
4. mongoose schema       enum / required / cast        → last line of defence
```

**why it is written this way**

- **Allowlist, not blocklist.** An unknown key is a `400`, so a typo like
  `prioriy` is reported instead of being silently dropped by Mongoose.
- **Server-owned fields are dropped, not rejected** (`_id`, `userId`,
  `createdAt`, `updatedAt`, `__v`) so a client can PATCH back a task it fetched.
- **Only `value` reaches the database.** The raw body is never spread into the
  model, so a client cannot set `userId` and steal ownership — that comes from
  `req.user._id`. This is what stops mass assignment.
- **Collect every error, don't stop at the first.** The client fixes the whole
  form in one round trip.
- **Normalise before comparing.** `"In Progress"` becomes `in-progress`, text is
  trimmed, tag arrays are trimmed and de-duplicated.
- **Cross-field rules live here too.** `startReminder` must be before `dueDate`;
  dates cannot be in the past. On a PATCH that sends only one of the two dates,
  the controller loads the stored one and compares against it.
- **Same shape as every other error**, because each entry is
  `{ field, message }` — and `normaliseError` maps Mongoose's `ValidationError`
  into exactly that shape.

```json
{
  "success": false,
  "status": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "title", "message": "title must be a string between 3 and 100 characters" },
    { "field": "description", "message": "description is required" }
  ]
}
```

**bulk create reuses all of it** — each element is validated with
`prefix: "tasks[2]."`, so the client is told exactly which task in the batch
failed, and the batch is capped at 10 per request.

> A library (Joi / Zod / express-validator) would replace the readers with a
> schema and less code. The layering and the error shape would stay the same.

---

## 14. Health check

### Package installed

Nothing — one route plus a mongoose property.

### Important code

```js
// app.js — public, unauthenticated, no rate limit, unversioned
app.get('/health', (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;

    res.status(dbConnected ? 200 : 503).json({
        status: dbConnected ? 'ok' : 'unavailable',
        db: dbConnected ? 'connected' : 'disconnected',
        uptime: Math.floor(process.uptime())
    });
});
```

```js
// keep the polling out of the logs
const skipHealthCheck = (req) => req.path === '/health';

app.use(morgan(isProduction ? 'combined' : 'dev', { skip: skipHealthCheck }));
```

### Logic

- A load balancer, container platform or uptime monitor pings this every few
  seconds to decide whether this instance should receive traffic.
- **It answers a real question, not "is Node alive".** `app.listen` succeeds even
  when the database is down, because `mongoose.connect` is asynchronous and
  nobody waits for it. So the server can be listening and still fail every
  request. Checking `readyState` is what makes the answer honest.
- `readyState` is a **property read, not a query**, so this stays cheap even when
  polled constantly. Running a real ping/query would add load exactly when the
  system is already unhealthy.
- **The status code is the message.** `200` means keep sending traffic, `503`
  means take this instance out of rotation. Monitors read the code, not the JSON.
- **No auth and no rate limit**, because the checker has no token and polls
  constantly. It exposes nothing sensitive — just up/down and uptime.
- **Unversioned**, mounted next to `/api-docs`, because it describes the server
  rather than the v1 API contract.
- Morgan skips it, otherwise a check every 10 seconds buries real traffic in the
  log — roughly 8,600 lines a day of noise.

`readyState` values

```text
0  disconnected
1  connected      → the only healthy value
2  connecting
3  disconnecting
```

**what a bigger app adds later**

```text
version / git commit    which build is actually running
separate endpoints      /health/live (restart me?) vs /health/ready (send traffic?)
dependency checks       redis, S3, third-party APIs
```

---

## 15. Request logging (morgan)

### Package installed

```bash
npm install morgan
```

### Important code

```js
// app.js
const isProduction = process.env.NODE_ENV === 'production';

// a health check pinged every 10s would bury real traffic
const skipHealthCheck = (req) => req.path === '/health';

// console log — mounted early so 404s and 429s are logged too
app.use(morgan(isProduction ? 'combined' : 'dev', { skip: skipHealthCheck }));

// local history only. Container disks are ephemeral, so in production we log to
// stdout and let the platform (CloudWatch / Azure Monitor) capture it.
if (!isProduction) {
    const logsDir = path.join(__dirname, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });

    app.use(morgan('combined', {
        stream: fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' }),
        skip: skipHealthCheck
    }));
}
```

### Logic

**What it does:** one line per finished request. Nothing more.

**`dev` vs `combined`** — same request, two audiences.

```text
dev       (development, coloured, short)
GET /api/v1/tasks 200 14.271 ms - 542

combined  (production / file, Apache format)
::1 - - [12/Aug/2026:11:42:09 +0000] "GET /api/v1/tasks HTTP/1.1" 200 542
    "-" "PostmanRuntime/7.43.0"
```

`dev` is for a human watching a terminal. `combined` adds IP, timestamp,
referrer and user-agent — the fields log tools parse and you actually need when
debugging something that happened yesterday.

**Two `app.use(morgan(...))` calls, on purpose.** The first writes to the
console, the second appends to `logs/access.log`. Morgan writes to one stream per
instance, so two destinations means two instances. The file one only runs in
development because container disks are wiped on restart.

**It logs when the response finishes, not when the request arrives.** That is how
it knows the status code and the duration. So a request that hangs forever never
appears in the log — which is itself a clue.

**Mounted early, above the routes.** Anything registered later is still logged,
because the log line is written at response time. Being early means requests that
never reach a route are logged too: 404s, 429s from the rate limiter, and CORS
rejections. Put morgan below the routes and you lose exactly the lines you want
during an incident.

**Skipping `/health`.** A load balancer polling every 10 seconds writes about
8,600 lines a day of nothing. `skip` takes a function returning true to drop the
line.

**What morgan does not do:** it never logs error details or stack traces. It only
sees status codes. Error bodies come from `console.error` in the global handler.
The two together give you the full picture — morgan says *what was requested*,
the error handler says *what went wrong*.

```text
morgan          → GET /api/v1/tasks/abc 400 2.104 ms - 118
error handler   → the AppError, or the full stack for a bug
```

> Later, a real app replaces this with structured JSON logs (pino / winston) plus
> a request id, so one user's journey can be traced across many lines.

---

## 16. Middleware order in app.js

### Package installed

Nothing — this is just the order the lines are written in.

### Important code

The whole chain, top to bottom, as it appears in `app.js`:

```js
app.use(helmet());                          // 1  safe headers
app.use(morgan(...));                       // 2  log every request
app.use(cors({ ... }));                     // 3  who may call us
app.use(express.json());                    // 4  body → req.body
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));          // 5  serve files if they exist
app.get('/health', ...);                    // 6  infrastructure endpoints
app.use('/api-docs', docsSecurityHeaders, swaggerUi.serve, swaggerUi.setup(...));
app.use('/api/v1', v1Routes);               // 7  the real API
app.use((req, res, next) => {               // 8  404 — nothing matched
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});
app.use((err, req, res, next) => { ... });  // 9  error handler — LAST
```

### Logic

**The model.** Express keeps one ordered list. For each request it walks the list
from the top and runs whatever matches the path. Each middleware then either
**answers** (`res.json`, `res.send`) or **passes on** (`next()`). The first one to
answer ends the request; everything below it never runs.

So the order is not style — it is the program.

**Why each position matters**

```text
1 helmet first        every response gets the headers, including 404s and errors
2 morgan next         so 404s, 429s and CORS rejections are logged too
3 cors before parsers a blocked origin is rejected before we buffer its body
4 body parsers        must run BEFORE any route that reads req.body
5 static              a real file short-circuits and skips your routes entirely
6 /health, /api-docs  specific paths, unversioned, registered before the API
7 /api/v1 router      the real work — rate limiter lives inside routes/v1.js
8 404 catch-all       only reached because nothing above it answered
9 error handler       must be last, and must take 4 arguments
```

**Two special positions**

- **The 404 has no path**, so it matches everything. That only works because it
  sits *below* every real route. Move it up one line and your whole API returns
  404. Its job is "we got to the bottom of the list, so nothing matched".
- **The error handler is recognised by its 4 parameters** `(err, req, res, next)`.
  It is skipped during normal flow and only entered when something calls
  `next(err)` or throws. Mounted anywhere but last, it never sees the errors from
  the routes below it.

**What breaks if you get it wrong**

```text
express.json() after the routes   → req.body is undefined in every controller
helmet last                       → 404 and error responses lose their headers
morgan last                       → the failures you want to debug are unlogged
404 above the routes              → every request 404s
error handler not last            → errors fall through to Express's default
                                    HTML error page instead of your JSON shape
error handler with 3 arguments     → treated as normal middleware, never runs
```

**One rule of thumb:** cheap and universal at the top, specific in the middle,
catch-alls at the bottom.

---

## 17. Ownership scoping

### Package installed

Nothing — a discipline, applied in every controller.

### Important code

```js
// every read, update and delete is filtered by owner
const filter = { userId: req.user._id };

await Task.findOne({ _id: req.params.id, userId: req.user._id });
await Task.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, updates, { new: true });
await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

// and on create, the owner comes from the token — never from the body
const task = new Task({ ...value, userId: req.user._id });
```

### Logic

- `req.user` was set by `protect` (§6), so `req.user._id` is the only identity the
  controllers trust.
- The owner is part of the **query**, not an `if` after the query. `findOne({ _id })`
  followed by a check would still load someone else's document into memory first.
- Someone else's id returns `null`, and the controller answers **404, not 403** —
  "not found" leaks nothing about whether that id exists at all.
- `userId` is in `SERVER_OWNED_FIELDS`, so a client sending `userId` in the body
  has it dropped. Without that, a user could create tasks owned by someone else.
- This is the whole authorization model right now: one user, their own rows. Role
  based rules (`admin` can see all) are still on the todo list.

---

## 18. Query features on GET /tasks

### Package installed

Nothing — plain mongoose query building.

### Important code

```js
const filter = { userId: req.user._id };

if (req.query.status) filter.status = req.query.status;
if (req.query.priority) filter.priority = req.query.priority;
if (req.query.tag) filter.tags = req.query.tag;      // matches one item in the array

if (req.query.search) {
    filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
    ];
}

// allowlist — an unknown sort field is ignored, not passed to mongo
const allowedSortFields = ['createdAt', 'updatedAt', 'dueDate', 'title', 'priority', 'status'];
let sort = '-createdAt';

if (req.query.sort) {
    const field = req.query.sort.startsWith('-') ? req.query.sort.slice(1) : req.query.sort;
    if (allowedSortFields.includes(field)) sort = req.query.sort;
}

const tasks = await Task.find(filter).sort(sort);
```

### Logic

- The filter object is **built up**, then handed to mongo once — one query, not one
  per option.
- `filter.tags = 'work'` matches an array containing `'work'`. Mongoose does that
  for array fields automatically.
- `$or` + `$regex` with `$options: 'i'` is a case-insensitive "contains" across two
  fields.
- The sort **allowlist** exists so a client cannot sort by an arbitrary field and
  force an expensive unindexed scan. Anything unknown silently falls back to
  `-createdAt` (newest first).
- `-field` means descending, which is mongoose shorthand, so `?sort=-dueDate` works.

```text
GET /tasks?status=pending&priority=high&tag=work&search=milk&sort=-dueDate
```

> Two known gaps: there is no pagination yet, so this returns every matching row,
> and `search` goes straight into `$regex` unescaped — a user typing `(` breaks the
> query. Both are on the todo list.

---

## 19. Bulk endpoints

### Package installed

Nothing.

### Important code

```js
// routes/task.js — NOTE the order
router.delete('/bulk', deleteManyTasks);              // static path first
router.get('/:id', validateObjectId(), getTaskById);  // param route after
router.post('/bulk', createTasksInBulk);
```

```js
// create many — capped, and every element validated
const BULK_CREATE_LIMIT = 10;

if (!Array.isArray(tasksFromBody) || tasksFromBody.length === 0) {
    throw new AppError('Send an array of tasks in body.tasks', 400, [
        { field: 'tasks', message: 'tasks must be a non-empty array' }
    ]);
}

tasksFromBody.forEach((task, index) => {
    const { errors: taskErrors, value } = validateTaskBody(task, { prefix: `tasks[${index}].` });
    errors.push(...taskErrors);
    tasksWithUser.push({ ...value, userId: req.user._id });
});

if (errors.length > 0) throw validationError(errors);

const savedTasks = await Task.insertMany(tasksWithUser);
```

```js
// delete many — ids scoped to the owner
const result = await Task.deleteMany({ _id: { $in: ids }, userId: req.user._id });
res.json({ message: `${result.deletedCount} task(s) deleted`, deletedCount: result.deletedCount });
```

### Logic

- **Route order gotcha:** `/bulk` must be registered **before** `/:id`, otherwise
  `:id` matches the literal string `"bulk"` and the request goes to the wrong
  controller (and fails ObjectId validation).
- **Validate the whole batch, then save.** Errors from all elements are collected
  and labelled `tasks[2].title`, so the client fixes everything in one round trip
  instead of discovering failures one at a time.
- **The limit of 10** stops one request from turning into an unbounded write.
- `insertMany` is a single round trip to mongo instead of ten `save()` calls.
- `deleteMany` is filtered by `userId` as well as `_id`, so passing another user's
  ids simply deletes nothing — `deletedCount` tells the truth.

---

## 20. Mongoose schema detail

### Package installed

Nothing new — mongoose from §4.

### Important code

```js
// models/task.js
const TaskSchema = mongoose.Schema({
    title:  { type: String, required: true },
    status: {
        type: String,
        enum: ['not-started', 'pending', 'completed', 'in-progress'],
        default: 'not-started'
    },
    dueDate: { type: Date, required: false },
    tags:    { type: [String], required: false },
    userId:  {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });   // createdAt + updatedAt, auto on create/update

module.exports = mongoose.model('Task', TaskSchema);
```

```js
// models/user.js
email: { type: String, required: true, unique: true, lowercase: true, trim: true }
```

### Logic

- **`enum`** is the database's copy of the same rule the controller enforces. The
  controller gives a friendly per-field message; the schema is the backstop for any
  write that skips it.
- **`ref: 'User'`** documents the relationship and enables `.populate()` later. It
  stores only the ObjectId — MongoDB does not enforce the foreign key, so a deleted
  user leaves orphan tasks behind.
- **`timestamps: true`** adds and maintains `createdAt` / `updatedAt`, which is why
  the update controller does not set `updatedAt` itself.
- **`lowercase` and `trim`** are setters that normalise on write, so
  `"  Bob@X.com "` is stored as `bob@x.com` and login lookups match.
- **`unique: true` is an index, not a validator.** It is enforced by MongoDB, and
  the duplicate error arrives as `code 11000` — which is why `normaliseError` maps
  it to a 409. It also has to be built, hence `User.syncIndexes()` at startup (§4).
- **Model name → collection name:** `'Task'` becomes `tasks`, lowercased and
  pluralised.
- Validators only run on `save()` and, for updates, when you pass
  `{ runValidators: true }` — which the update controller does.

> Still to do: real indexes on the fields we filter and sort by (`userId`,
> `status`, `dueDate`). Right now every list query is a collection scan.

---

## Remaining topics — not built yet (from todo.md)

| # | Topic | Note |
|---|-------|------|
| 1 | Pagination | `?page=1&limit=10` — real APIs never return all rows |
| 2 | MongoDB indexes | index `userId`, `status`, `dueDate` on tasks |
| 3 | Role authorization | the `role` field exists but nothing checks it yet |
| 4 | Escape `?search` regex | user input goes straight into `$regex` |
| 5 | Caching | in-memory first, then Redis |
| 6 | File uploads | `multer`, attachments on tasks |
| 7 | Tests | Supertest — auth, CRUD, ownership |
| 8 | Deploy + CI/CD | Atlas, host, GitHub Actions |
