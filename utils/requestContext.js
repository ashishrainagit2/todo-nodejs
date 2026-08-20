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

// Filter Datadog / the terminal on requestId. userId is null until JWT verifies
// (and stays null on public routes / bad tokens).
function logWithContext(label, extra = {}) {
    const { requestId, userId } = getContext();
    console.error(JSON.stringify({
        label,
        requestId: requestId || null,
        userId: userId || null,
        ...extra
    }));
}

module.exports = { getContext, setContext, requestContext, logWithContext };
