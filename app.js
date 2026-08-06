const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv/config');

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
            callback(new Error('Not allowed by CORS'));
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

const TaskRoutes = require('./routes/task')
const AuthRoutes = require('./routes/auth')
const { apiLimiter, authLimiter } = require('./middleware/rateLimit')

app.use('/tasks', apiLimiter, TaskRoutes)
app.use('/auth', authLimiter, AuthRoutes)

// handle 404
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// global error handler — 4 parameters required!
// Express recognizes error handlers by 4 arguments (err, req, res, next). Errors arrive via next(e) from your catch blocks — it turns crashes into JSON responses with 400 or 500.
app.use((err, req, res, next) => {
    console.log('Error ===>:', err);

    let status = err.statusCode || err.status || 500;
    let message = err.message || 'Internal server error';

    if (err.name === 'ValidationError') {
        status = 400;
        message = Object.values(err.errors)
            .map((e) => e.message)
            .join('; ');
    } else if (err.name === 'CastError') {
        status = 400;
        message = 'Invalid id format';
    } else if (err.code === 11000 || err.code === 11001) {
        status = 409;
        message = 'Email already registered';
    }

    res.status(status).json({ message });
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

app.listen(process.env.PORT, () => {
    console.log(`server running in ${process.env.PORT}`)
})





