require('dotenv/config');
const express = require('express');
const app = express();
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const AppError = require('./utils/AppError');
const { requestContext } = require('./utils/requestContext');
const logger = require('./utils/logger');
const { fetchWithTimeout, DEFAULT_TIMEOUT_MS } = require('./utils/httpClient');


const isProduction = process.env.NODE_ENV === 'production';

// Safe HTTP headers — nosniff, frame deny, CSP, HSTS (see learn.md §10b).
// First middleware so even errors and 404s carry the headers.
app.use(helmet());

// Correlation id + AsyncLocalStorage — must run BEFORE morgan so :id is set,
// and wrap next() so every later await still sees this request's store.
app.use(requestContext);

// Request logging (see learn.md §12) — mounted early so 404s and 429s are logged too.
// A health check pinged every 10s would bury real traffic.
const skipHealthCheck = (req) => req.path === '/health';
morgan.token('id', (req) => req.id || '-');
// Tokens run when the response finishes, so protect has already set req.user.
// '-' means anonymous: public route, no token, or a rejected one.
morgan.token('user', (req) => (req.user?._id ? String(req.user._id) : '-'));
const morganDev = ':id :user :method :url :status :response-time ms - :res[content-length]';
const morganCombined = ':id :user :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

app.use(morgan(isProduction ? morganCombined : morganDev, { skip: skipHealthCheck }));

// Local history only. Container disks are ephemeral, so in production we log to
// stdout and let the platform (CloudWatch / Azure Monitor) capture it.
if (!isProduction) {
    const logsDir = path.join(__dirname, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });

    app.use(morgan(morganCombined, {
        stream: fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' }),
        skip: skipHealthCheck
    }));
}

const parseOrigins = (value) =>
    value ? value.split(',').map((origin) => origin.trim()) : [];

const productionOrigins = parseOrigins(process.env.CORS_ORIGIN);
const devOrigins = parseOrigins(process.env.CORS_ORIGIN_DEV);

// production → CORS_ORIGIN only
// development → CORS_ORIGIN_DEV only (e.g. Next.js on localhost:3000)
const allowedOrigins =
    process.env.NODE_ENV === 'production'
        ? productionOrigins
        : devOrigins;

app.use(cors({
    origin(origin, callback) {
        // Postman, curl, server-to-server — no Origin header
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // callback(new Error('Not allowed by CORS'));
            callback(new AppError('Not allowed by CORS', 403, [], 'ERR_CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// express.json() parses JSON from incoming requests into req.body — it's for reading what the client sends, not for converting the response.
app.use(express.json());
// Same idea as express.json(), but for form-encoded bodies.
// One line: Parses form-style request bodies into req.body — backup for non-JSON submissions.
app.use(express.urlencoded({ extended: true }));
// express.static() serves static files from the 'public' directory — it's for serving files like images, CSS, and JavaScript, not for converting the response.
app.use(express.static('public'));

// Health check (see learn.md §12) — public, unauthenticated, no rate limit.
// readyState is a property read, not a query, so this stays cheap when polled every few seconds.
// 1 = connected; anything else means real requests would fail, so report 503 and let the
// platform take this instance out of rotation.
app.get('/health', (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;

    res.status(dbConnected ? 200 : 503).json({
        status: dbConnected ? 'ok' : 'unavailable',
        db: dbConnected ? 'connected' : 'disconnected',
        uptime: Math.floor(process.uptime())
    });
});

// TEMP — error-handling lab. Hit these in Postman, watch the nodemon terminal.
// Delete this route when done. See error-handling.md §10.

// GET http://localhost:3005/error-lab
// GET http://localhost:3005/error-lab?case=sync
// GET http://localhost:3005/error-lab?case=await
// GET http://localhost:3005/error-lab?case=float
// GET http://localhost:3005/error-lab?case=timeout
// GET http://localhost:3005/error-lab?case=early
// GET http://localhost:3005/error-lab?case=stack
// GET http://localhost:3005/error-lab?case=weather-lost   (wrap without cause — crime scene gone)
// GET http://localhost:3005/error-lab?case=weather-cause  (wrap with cause — both stacks)
// GET http://localhost:3005/error-lab?case=hang           (never answers — the danger)
// GET http://localhost:3005/error-lab?case=weather-timeout (AbortController cuts it at 3s)

function printCauseChain(err) {
    let depth = 0;
    let cur = err;
    while (cur) {
        logger.error(
            { depth, name: cur.name || 'Error', stack: cur.stack },
            `chain[${depth}] ${cur.message}`
        );
        cur = cur.cause;
        depth += 1;
    }
}

// Stand-in for OpenWeather: hit a closed port so Node throws a real network error
// (ECONNREFUSED), not an HTTP 4xx. Same lesson as a dropped TCP connection to weather.
async function callFakeWeatherApi() {
    const res = await fetchWithTimeout('http://127.0.0.1:1/v1/forecast?q=Delhi');
    if (!res.ok) {
        throw new Error(`weather HTTP ${res.status}`);
    }
    return res.json();
}

// The lecture's scenario: the upstream ACCEPTS the connection and then never answers.
// ?case=hang is that upstream (our own server, playing the broken inventory API).
async function callHangingApi() {
    const res = await fetchWithTimeout(
        `http://127.0.0.1:${process.env.PORT}/error-lab?case=hang`,
        { timeoutMs: 3000 }
    );
    return res.json();
}

app.get('/error-lab', async (req, res, next) => {
    const kind = req.query.case;

    try {
        if (kind === 'sync') {
            throw new Error('lab: sync throw');
        }

        if (kind === 'await') {
            await Promise.reject(new Error('lab: awaited reject'));
            return;
        }

        // try/catch catches a throw. Promise.reject(...) without await does not throw. It creates a promise object and returns it. That is a normal, successful line of JavaScript.
        // await is the thing that turns a rejection into a throw:
        // Why Express is done

        // Express is waiting on one thing: the promise that async (req, res) => { ... } returns.
        // That promise succeeds when the function returns (or runs off the end) without throwing.

        // Timeline for float:

        // Tick 1 (handler is running)
        //   Promise.reject(...)     // started a second promise, ignored it
        //   res.json(200)           // HTTP response sent
        //   return                  // async function is finished SUCCESSFULLY
        //   → Express: “handler promise fulfilled. I am done. No next(err).”

        // Tick 2 (handler is gone)
        //   that second promise rejects
        //   → Express is not in this stack
        //   → catch is not in this stack
        //   → Node: unhandledRejection → process can exit

        // Express is “done” because you already returned. Sending res.json and returning says “this request succeeded.” There is no hook left for a later reject. Express does not keep a listener on promises you did not await or return.

        // Short version: forgot await = you started work and declared the request finished before that work failed. catch only wraps the declare-finished part. The failure arrives after the wrapping is over.

        // Yes. One forgotten await on a promise that later rejects can crash the whole Node process — try/catch and the Express error handler will not see it.

        // Forgotten await on a promise that succeeds does not crash. It just means you did not wait; the request may finish too early. The crash is specifically: reject + nobody catching that promise.

        // What Node actually does:

        // 1. Handler starts.
        // 2. Task.find(...) — Node does *not* sit and wait on your thread.
        //    It asks the OS / Mongo driver: “run this query, ping me when done.”
        // 3. This function hits `await` and *pauses*. The event loop is free.
        //    Another client’s POST /login can run in that gap.
        // 4. Later: Mongo answers. Node resumes *this* function after the await.
        // 5. res.json(tasks).

        // The query ran outside the original call stack. That is the quote: “execution steps outside that immediate flow.”

        if (kind === 'float') {
            // Missing await on purpose. try/catch does NOT see this.
            Promise.reject(new Error('lab: floating reject'));
            logger.info('LAB try finished for float — catch did not run. Crash comes next tick.');
            return res.json({
                caughtByExpress: false,
                tryCatchRan: false,
                note: '200. Watch terminal: no "LAB CATCH RAN", then unhandledRejection / nodemon restart.'
            });
        }

        if (kind === 'timeout') {
            setTimeout(() => {
                throw new Error('lab: throw inside setTimeout');
            }, 100);
            logger.info('LAB try finished for timeout — catch did not run. Crash comes from the timer.');
            return res.json({
                caughtByExpress: false,
                tryCatchRan: false,
                note: '200. Watch terminal: no "LAB CATCH RAN", then uncaughtException / nodemon restart.'
            });
        }

        if (kind === 'early') {
            // Forgot await, but the promise SUCCEEDS. No crash — you just answered too soon.
            const slow = new Promise((resolve) => {
                setTimeout(() => {
                    logger.info('LAB slow work finished (success). Process still alive — no crash.');
                    resolve('pretend db row');
                }, 1500);
            });
            void slow;
            return res.json({
                crashed: false,
                note: '200 immediately, before the 1.5s work finished. Watch terminal: a log later, server still up. Contrast with ?case=float (same forgotten await, but that promise REJECTS → crash).'
            });
        }

        if (kind === 'stack') {
            class WithoutCapture extends Error {
                constructor(message) {
                    super(message);
                    this.name = 'WithoutCapture';
                }
            }

            const without = new WithoutCapture('demo');
            const withCapture = new AppError('demo', 400);

            const firstLines = (err) => (err.stack || '').split('\n').slice(0, 4);

            return res.json({
                whatIsStack: 'error.stack is a string: the call list when the error was created. Each "at ..." line is one frame (one function).',
                constructorFrame: 'the line inside new AppError / new WithoutCapture — the factory, not where you decided to fail.',
                withoutCaptureStackTrace: firstLines(without),
                withCaptureStackTrace: firstLines(withCapture),
                read: 'without: first "at" is the constructor. with: first "at" is this /error-lab handler (the new AppError line).'
            });
            // GET http://localhost:3005/error-lab?case=stack
        }

        if (kind === 'weather-lost') {
            try {
                await callFakeWeatherApi();
            } catch (orig) {
                logger.error({ err: orig }, 'ORIGINAL network error (we will THROW IT AWAY)');
                throw new AppError(
                    'Weather service unavailable',
                    503,
                    [],
                    'ERR_WEATHER_UNAVAILABLE'
                );
            }
        }

        if (kind === 'hang') {
            // Deliberately never responds: no res.json, no next, no throw.
            // This is the broken inventory API from the lecture. Called directly it
            // ties up a socket until you give up; that is the whole point.
            logger.warn('LAB hang: accepted the connection, will never answer');
            return;
        }

        if (kind === 'weather-timeout') {
            try {
                await callHangingApi();
            } catch (orig) {
                // fetchWithTimeout already turned the abort into a 504 AppError.
                // Anything else (refused, DNS) still needs wrapping here.
                if (orig instanceof AppError) throw orig;
                throw new AppError(
                    'Weather service unavailable',
                    503,
                    [],
                    'ERR_WEATHER_UNAVAILABLE',
                    orig
                );
            }
        }

        if (kind === 'weather-cause') {
            try {
                await callFakeWeatherApi();
            } catch (orig) {
                throw new AppError(
                    'Weather service unavailable',
                    503,
                    [],
                    'ERR_WEATHER_UNAVAILABLE',
                    orig
                );
            }
        }

        res.json({
            usage: 'GET /error-lab?case=sync|await|float|timeout|early|stack|weather-lost|weather-cause|hang|weather-timeout',
            proof: 'This whole handler is inside try/catch. sync+await → "LAB CATCH RAN". float+timeout → catch silent, process dies. early → forgot await on SUCCESS, no crash.',
            cases: {
                sync: 'throw in try → CATCH RUNS → JSON 500. Process lives.',
                await: 'await reject in try → CATCH RUNS → JSON 500. Process lives.',
                float: 'forgot await → CATCH NEVER RUNS → crash anyway',
                timeout: 'throw in setTimeout → CATCH NEVER RUNS → crash anyway',
                early: 'forgot await on a SUCCESS → 200 too soon, process lives',
                stack: 'compare error.stack with vs without Error.captureStackTrace',
                'weather-lost': 'fetch dead weather host, wrap in AppError WITHOUT cause. Client 503 clean. Log: only AppError stack — ECONNREFUSED gone.',
                'weather-cause': 'same fetch, AppError WITH cause. Client still 503 clean. Log: AppError caused by undici/ECONNREFUSED (both stacks).',
                hang: `accepts the connection and NEVER answers. Postman spins forever — that socket is held hostage. Ctrl-C it. Default outbound deadline elsewhere: ${DEFAULT_TIMEOUT_MS}ms.`,
                'weather-timeout': 'calls ?case=hang through fetchWithTimeout. AbortController severs the socket at 3s → 504 ERR_UPSTREAM_TIMEOUT, cause = AbortError. Predictable failure instead of an infinite hang.'
            }
        });
    } catch (e) {
        logger.error(`LAB CATCH RAN ===> ${e.message}`);
        if (kind === 'weather-lost' || kind === 'weather-cause') {
            logger.error('Cause chain from the throw (lost = 1 frame, cause = 2+)');
            printCauseChain(e);
        }
        next(e);
    }
});

// Interactive docs, generated from the @openapi comments in routes/*.js.
// Unversioned like /health — it describes the whole server, not one API contract.
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');

// Swagger UI ships an inline init script and inline styles, which the global
// helmet CSP blocks. Relax it on this path only instead of app-wide.
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

app.use('/api-docs', docsSecurityHeaders, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Todo API — docs',
    // keep the pasted token across page reloads
    swaggerOptions: { persistAuthorization: true }
}));

// the raw spec, for Postman/Insomnia import and client generators
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// API versioning — the prefix lives in one place so adding /api/v2 later
// means one more mount, not edits scattered across route files.
const V1_PREFIX = '/api/v1';
const v1Routes = require('./routes/v1');

app.use(V1_PREFIX, v1Routes);

// handle 404 — hand to the error handler so unknown routes get the same shape
app.use((req, res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, [], 'ERR_ROUTE_NOT_FOUND'));
});

// Turn a known library error into an AppError. Anything not listed here is a bug.
// It is a translator, not a catcher. It runs inside the 4-arg handler, after Express has already handed you err.

// The handler only knows two buckets: AppError (safe to show) vs everything else (bug → 500 + "Something went wrong"). Libraries do not throw AppError. They throw their own types. normaliseError maps the ones you expect into AppError so they get a proper status and message instead of looking like a crash.

// | Incoming err                         | Becomes                                      |
// |--------------------------------------|----------------------------------------------|
// | already AppError                     | unchanged (throw from a controller)          |
// | Mongoose ValidationError             | 400, per-field messages                      |
// | Mongoose CastError                   | 400, bad id                                  |
// | duplicate key 11000 / 11001          | 409, email taken                             |
// | express.json() parse fail            | 400, malformed JSON                          |
// | anything else (Error: test error)    | returned as-is → unknown → 500               |

// Without it, User.create({ email: 'not-an-email' }) would still be a Mongoose error, so the client would get 500 "Something went wrong" even though that is a normal bad request.

// normaliseError does not look at status 500 and then decide. It looks at what kind of object err is.

// Already AppError → return it unchanged. Controllers already did the work (401, 404, 409 you threw yourself).
// A library error that would have been treated as a bug (plain Error → 500) but is actually a bad request → wrap it in AppError with 400 or 409.
// Those library errors are not 500s yet. They become 500 only if normaliseError does not match them, because the handler’s default bucket is “unknown → 500”.

// | What arrives                         | What normaliseError does              |
// |--------------------------------------|---------------------------------------|
// | AppError (you threw it)              | pass through, no change               |
// | Mongoose / JSON parse (library)      | wrap as AppError 400 or 409           |
// | anything else                        | pass through → handler makes it 500   |


const normaliseError = (err) => {
    if (err instanceof AppError) return err;
    if (err.name === 'ValidationError') {
        // Mongoose schema validation — report per field, like our own validators do
        const errors = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message
        }));
        return new AppError('Validation failed', 400, errors, 'ERR_VALIDATION');
    }

    if (err.name === 'CastError') {
        return new AppError('Invalid id format', 400, [
            { field: err.path, message: `${err.path} must be a valid id` }
        ], 'ERR_INVALID_ID');
    }

    if (err.code === 11000 || err.code === 11001) {
        return new AppError('Email already registered', 409, [
            { field: 'email', message: 'email is already registered' }
        ], 'ERR_EMAIL_TAKEN');
    }

    // Body parser rejected the JSON before any route ran
    if (err.type === 'entity.parse.failed') {
        return new AppError('Malformed JSON in request body', 400, [], 'ERR_MALFORMED_JSON');
    }

    return err;
};

// global error handler — 4 parameters required!
// Express recognizes error handlers by 4 arguments (err, req, res, next). Errors arrive
// via next(e) or a throw in a controller, and become the one JSON shape below.

// | Default Express handler     | Yours                                      |
// |-----------------------------|--------------------------------------------|
// | HTML page                   | JSON                                       |
// | message/stack depend on env | one shape: success, status, message        |
// | no idea what Mongoose is    | normaliseError → 400/409 instead of 500    |
// | leaks "test error" in dev   | unknown bugs → "Something went wrong"      |

// Same format is the API contract: Postman, a frontend, and /api-docs can all rely on { success: false, status, message }. An HTML <pre> is useless to fetch().

// missing await — Express thinks the handler finished OK
// User.findOne({ email }).then((u) => { throw new Error('nope'); });

// setTimeout(() => { throw new Error('too late'); }, 0);

// Those never hit (err, req, res, next). They become unhandledRejection / uncaughtException.

// Express only watches the promise the handler returns. If you do not return a promise, it will not watch for errors.

app.use((err, req, res, next) => {
    const error = normaliseError(err);
    const isKnown = error instanceof AppError;

    // pino's mixin adds requestId + userId to every line below, so grepping one id
    // returns the whole story — summary and stack, not just the summary.
    if (!isKnown) {
        // Unknown errors are bugs: log the stack, tell the client nothing
        logger.error({ err: error, code: 'ERR_INTERNAL', status: 500 }, 'unhandled error');
    } else {
        logger.warn(
            { code: error.code, status: error.statusCode },
            `handled: ${error.message}`
        );

        if (error.cause) {
            // Operational + chained: client still gets the tidy AppError. Logs keep the root.
            printCauseChain(error);
        }
    }

    const statusCode = isKnown ? error.statusCode : 500;
    const message = isKnown ? error.message : 'Something went wrong';

    const body = {
        success: false,
        status: statusCode,
        message,
        code: isKnown ? error.code : 'ERR_INTERNAL'
    };

    if (isKnown && error.errors.length > 0) {
        body.errors = error.errors;
    }

    // Local debugging aid — never sent in production
    if (!isProduction && !isKnown) {
        body.stack = error.stack;
    }

    res.status(statusCode).json(body);
});

mongoose.connect(process.env.DB_CONNECTION)
    .then(async () => {
        logger.info('Connected to database');
        const User = require('./models/user');
        try {
            await User.syncIndexes();
            logger.info('User indexes synced (unique email)');
        } catch (err) {
            logger.error({ err }, 'User index sync failed — remove duplicate emails first');
        }
    })
    .catch((err) => logger.error({ err }, 'Database connection error'));

// Listen only when this file is the process entry (`npm start` → app.js).
// Cluster workers require() this module and call listen() from server.js instead.
if (require.main === module) {
    app.listen(process.env.PORT, () => {
        logger.info(`server running in ${process.env.PORT}`);
    });
}

module.exports = app;
