const express = require('express');
const app = express();
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const AppError = require('./utils/AppError');
require('dotenv/config');

const isProduction = process.env.NODE_ENV === 'production';

// Safe HTTP headers — nosniff, frame deny, CSP, HSTS (see learn.md §10b).
// First middleware so even errors and 404s carry the headers.
app.use(helmet());

// Request logging (see learn.md §12) — mounted early so 404s and 429s are logged too.
// A health check pinged every 10s would bury real traffic.
const skipHealthCheck = (req) => req.path === '/health';

app.use(morgan(isProduction ? 'combined' : 'dev', { skip: skipHealthCheck }));

// Local history only. Container disks are ephemeral, so in production we log to
// stdout and let the platform (CloudWatch / Azure Monitor) capture it.
if (!isProduction) {
    const logsDir = path.join(__dirname, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });

    app.use(morgan('combined', {
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
            callback(new AppError('Not allowed by CORS', 403));
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
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// Turn a known library error into an AppError. Anything not listed here is a bug.
const normaliseError = (err) => {
    if (err instanceof AppError) return err;

    if (err.name === 'ValidationError') {
        // Mongoose schema validation — report per field, like our own validators do
        const errors = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message
        }));
        return new AppError('Validation failed', 400, errors);
    }

    if (err.name === 'CastError') {
        return new AppError('Invalid id format', 400, [
            { field: err.path, message: `${err.path} must be a valid id` }
        ]);
    }

    if (err.code === 11000 || err.code === 11001) {
        return new AppError('Email already registered', 409, [
            { field: 'email', message: 'email is already registered' }
        ]);
    }

    // Body parser rejected the JSON before any route ran
    if (err.type === 'entity.parse.failed') {
        return new AppError('Malformed JSON in request body', 400);
    }

    return err;
};

// global error handler — 4 parameters required!
// Express recognizes error handlers by 4 arguments (err, req, res, next). Errors arrive
// via next(e) or a throw in a controller, and become the one JSON shape below.
app.use((err, req, res, next) => {
    const error = normaliseError(err);
    const isKnown = error instanceof AppError;

    // Unknown errors are bugs: log everything, tell the client nothing
    if (!isKnown) {
        console.error('Unhandled error ===>', error);
    }

    const statusCode = isKnown ? error.statusCode : 500;
    const message = isKnown ? error.message : 'Something went wrong';

    const body = {
        success: false,
        status: statusCode,
        message
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
        console.log('Connected to database');
        const User = require('./models/user');
        try {
            await User.syncIndexes();
            console.log('User indexes synced (unique email)');
        } catch (err) {
            console.error('User index sync failed — remove duplicate emails first:', err.message);
        }
    })
    .catch((err) => console.error('Database connection error:', err.message));

// Listen only when this file is the process entry (`npm start` → app.js).
// Cluster workers require() this module and call listen() from server.js instead.
if (require.main === module) {
    app.listen(process.env.PORT, () => {
        console.log(`server running in ${process.env.PORT}`);
    });
}

module.exports = app;
