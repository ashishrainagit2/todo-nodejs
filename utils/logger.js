const pino = require('pino');
const { getContext } = require('./requestContext');

const isProduction = process.env.NODE_ENV === 'production';

// mixin runs on EVERY log call and merges its return value into the line.
// This is the whole point: nobody has to remember to pass requestId around.
// Outside a request (boot, shutdown) the store is empty, so the fields are omitted.
const logger = pino({
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    mixin() {
        const { requestId, userId } = getContext();
        return requestId ? { requestId, userId: userId ?? null } : {};
    },
    // Production writes raw JSON to stdout for the platform to collect.
    // Locally pino-pretty makes it readable while you work.
    transport: isProduction
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
});

module.exports = logger;
