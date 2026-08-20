const { AsyncLocalStorage } = require('node:async_hooks');
const crypto = require('node:crypto');

// One bag of { requestId, userId } per incoming HTTP request.
// Survives await (Mongo, fetch) so a deep error log can still say "which click / which user".
const als = new AsyncLocalStorage();

function getContext() {
    return als.getStore() ?? {};
}

function setContext(patch) {
    const store = als.getStore();
    if (store) Object.assign(store, patch);
}

// First middleware after helmet. Everything inside next() shares this store.
function requestContext(req, res, next) {
    const requestId = req.get('x-request-id') || crypto.randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    als.run({ requestId, userId: null }, () => next());
}

// utils/logger.js reads this store in its pino mixin, so every log line carries
// requestId + userId without any caller passing them in.
module.exports = { getContext, setContext, requestContext };
