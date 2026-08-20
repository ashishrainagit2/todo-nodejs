const AppError = require('./AppError');
const logger = require('./logger');

// A hung upstream holds a socket, a pool slot and memory until it answers.
// Every outbound call gets a deadline so someone else's slow server cannot
// decide how much of our memory to consume. See readme.md "Timeouts".
const DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS) || 3000;

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...options } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Honour a caller's own signal (user disconnected, shutdown) alongside the deadline.
    const combined = signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal;

    const startedAt = Date.now();

    try {
        return await fetch(url, { ...options, signal: combined });
    } catch (orig) {
        // Our timer fired: the socket is already severed, so the request is no
        // longer holding resources. Turn the abort into an honest 504.
        if (controller.signal.aborted) {
            logger.warn(
                { url, timeoutMs, elapsedMs: Date.now() - startedAt },
                'outbound request aborted on timeout'
            );
            throw new AppError(
                'Upstream service timed out',
                504,
                [],
                'ERR_UPSTREAM_TIMEOUT',
                orig
            );
        }

        // DNS failure, refused connection, TLS error — let the caller wrap it.
        throw orig;
    } finally {
        // An un-cleared timer keeps the event loop alive for its full duration.
        clearTimeout(timer);
    }
}

module.exports = { fetchWithTimeout, DEFAULT_TIMEOUT_MS };
