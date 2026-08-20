const AppError = require('./AppError');
const logger = require('./logger');
const { getContext } = require('./requestContext');
const { breakerFor } = require('./circuitBreaker');

// A hung upstream holds a socket, a pool slot and memory until it answers.
// Every outbound call gets a deadline so someone else's slow server cannot
// decide how much of our memory to consume. See learn.md §20 and §21.
const DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS) || 3000;
const DEFAULT_RETRIES = Number(process.env.HTTP_RETRIES) || 2;
const DEFAULT_BACKOFF_MS = Number(process.env.HTTP_BACKOFF_MS) || 300;
const MAX_BACKOFF_MS = Number(process.env.HTTP_MAX_BACKOFF_MS) || 5000;

// Transient by nature: the same request may well succeed a moment later.
// 4xx like 400/401/404 are NOT here — retrying a rejected body just wastes both sides.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

// Retrying a POST can create two orders. Only replay methods that are safe to repeat,
// unless the caller explicitly opts in with retryNonIdempotent.
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Exponential backoff + FULL jitter: wait a random slice of a window that doubles
// each attempt (300 → 600 → 1200 …, capped). Backoff alone still leaves every
// instance on the same 1-2-4-8 schedule, so a recovering server gets hit by one
// synchronised wave — the thundering herd. Randomising spreads the crowd out.
function backoffDelay(attempt, baseMs, maxMs) {
    const window = Math.min(maxMs, baseMs * 2 ** attempt);
    return Math.round(Math.random() * window);
}

// Servers under pressure often say exactly how long to wait. Obey them over our math.
function retryAfterMs(res) {
    const header = res.headers.get('retry-after');
    if (!header) return null;

    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1000;

    const date = Date.parse(header);
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

async function fetchWithTimeout(url, {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    backoffMs = DEFAULT_BACKOFF_MS,
    maxBackoffMs = MAX_BACKOFF_MS,
    retryNonIdempotent = false,
    breakerKey,
    breakerOptions,
    signal,
    ...options
} = {}) {
    const method = (options.method || 'GET').toUpperCase();

    // One breaker per upstream by default. Health is a property of the service,
    // not of a single path — though a caller can scope it tighter with breakerKey.
    const breaker = breakerFor(breakerKey || new URL(url).origin, breakerOptions);

    // Hand our correlation id to the next service so one id spans the whole hop chain.
    const headers = new Headers(options.headers || {});
    const { requestId } = getContext();
    if (requestId && !headers.has('x-request-id')) headers.set('x-request-id', requestId);

    const canRetry = retryNonIdempotent || IDEMPOTENT_METHODS.has(method);
    const maxAttempts = canRetry ? retries + 1 : 1;

    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        // Asked before every attempt, so a breaker that trips mid-retry stops the
        // remaining attempts instead of finishing a schedule we know will fail.
        const gate = breaker.check();
        if (!gate.allowed) {
            throw new AppError(
                'Upstream service unavailable',
                503,
                [],
                'ERR_CIRCUIT_OPEN',
                new Error(
                    `circuit ${gate.state} for ${breaker.key} — no call attempted` +
                    (gate.retryInMs ? `, retrying upstream in ${gate.retryInMs}ms` : '')
                )
            );
        }

        // A fresh controller per attempt — a used signal stays aborted forever.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const combined = signal
            ? AbortSignal.any([controller.signal, signal])
            : controller.signal;
        const startedAt = Date.now();

        try {
            const res = await fetch(url, { ...options, headers, signal: combined });

            if (RETRYABLE_STATUS.has(res.status)) {
                breaker.onFailure(`status ${res.status}`);

                if (attempt === maxAttempts - 1) {
                    // Out of attempts and still failing — report it as our own 503.
                    throw new AppError(
                        'Upstream service unavailable',
                        503,
                        [],
                        'ERR_UPSTREAM_UNAVAILABLE',
                        new Error(`upstream responded ${res.status} after ${maxAttempts} attempt(s)`)
                    );
                }

                const wait = retryAfterMs(res) ?? backoffDelay(attempt, backoffMs, maxBackoffMs);
                logger.warn(
                    { url, status: res.status, attempt: attempt + 1, maxAttempts, waitMs: wait },
                    'upstream returned a retryable status — backing off'
                );
                await sleep(wait);
                continue;
            }

            // Any real answer — even a 404 — proves the upstream is alive and talking.
            // A 4xx is our request being wrong, which says nothing about its health.
            breaker.onSuccess();
            return res;
        } catch (orig) {
            if (orig instanceof AppError) throw orig;

            // The caller cancelled (user gone, shutdown). Never retry that, and never
            // blame the upstream for it — recording it would trip the breaker on our own act.
            if (signal?.aborted) throw orig;

            const timedOut = controller.signal.aborted;
            breaker.onFailure(timedOut ? 'timeout' : orig.code || orig.message);

            if (timedOut) {
                logger.warn(
                    { url, timeoutMs, elapsedMs: Date.now() - startedAt, attempt: attempt + 1, maxAttempts },
                    'outbound request aborted on timeout'
                );
                lastError = new AppError(
                    'Upstream service timed out',
                    504,
                    [],
                    'ERR_UPSTREAM_TIMEOUT',
                    orig
                );
            } else {
                // DNS failure, refused connection, TLS error.
                lastError = orig;
            }

            if (attempt === maxAttempts - 1) throw lastError;

            const wait = backoffDelay(attempt, backoffMs, maxBackoffMs);
            logger.warn(
                { url, attempt: attempt + 1, maxAttempts, waitMs: wait, reason: timedOut ? 'timeout' : orig.message },
                'outbound request failed — backing off'
            );
            await sleep(wait);
        } finally {
            // An un-cleared timer keeps the event loop alive for its full duration.
            clearTimeout(timer);
        }
    }

    throw lastError;
}

module.exports = { fetchWithTimeout, DEFAULT_TIMEOUT_MS, DEFAULT_RETRIES };
