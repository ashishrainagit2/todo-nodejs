const logger = require('./logger');

// The breaker box in your house: when the current surges, it trips and cuts the
// circuit so the wiring does not cook. Here the "surge" is a failure rate on one
// upstream, and what we protect is our own sockets, memory and patience.
//
// Timeouts bound one call, retries ride out a blip. Neither notices that an
// upstream has been dead for ten minutes and every attempt is a foregone
// conclusion. That is this file's job. See learn.md §22.
const WINDOW_MS = Number(process.env.CB_WINDOW_MS) || 10000;
const FAILURE_RATE = Number(process.env.CB_FAILURE_RATE) || 0.5;
const MIN_CALLS = Number(process.env.CB_MIN_CALLS) || 5;
const OPEN_MS = Number(process.env.CB_OPEN_MS) || 30000;

const CLOSED = 'closed';
const OPEN = 'open';
const HALF_OPEN = 'half-open';

class CircuitBreaker {
    constructor(key, {
        windowMs = WINDOW_MS,
        failureRate = FAILURE_RATE,
        minCalls = MIN_CALLS,
        openMs = OPEN_MS
    } = {}) {
        this.key = key;
        this.windowMs = windowMs;
        this.failureRate = failureRate;
        this.minCalls = minCalls;
        this.openMs = openMs;

        this.state = CLOSED;
        this.calls = []; // rolling window of { at, ok }
        this.openedAt = 0;
        this.probeInFlight = false;
        this.trips = 0;
    }

    // A rolling window, not an all-time counter: an upstream that failed twice an
    // hour ago is not sick now, and a lifetime total would never let it look healthy.
    prune(now = Date.now()) {
        const cutoff = now - this.windowMs;
        while (this.calls.length > 0 && this.calls[0].at < cutoff) this.calls.shift();
    }

    // Asked before every outbound attempt. The open → half-open transition is
    // computed from the clock rather than scheduled with a timer, so an idle
    // breaker holds nothing open on the event loop.
    check() {
        const now = Date.now();

        if (this.state === OPEN) {
            const waited = now - this.openedAt;
            if (waited < this.openMs) {
                return { allowed: false, state: OPEN, retryInMs: this.openMs - waited };
            }
            this.state = HALF_OPEN;
            this.probeInFlight = false;
            logger.info({ breaker: this.key }, 'circuit half-open — letting one scout through');
        }

        if (this.state === HALF_OPEN) {
            // Exactly one scout. Everyone else keeps failing fast, because a crowd
            // sent at a recovering upstream is how you knock it over again.
            if (this.probeInFlight) {
                return { allowed: false, state: HALF_OPEN, retryInMs: 0 };
            }
            this.probeInFlight = true;
            return { allowed: true, state: HALF_OPEN, probe: true };
        }

        return { allowed: true, state: CLOSED };
    }

    onSuccess() {
        if (this.state === HALF_OPEN) {
            this.state = CLOSED;
            this.calls = [];
            this.probeInFlight = false;
            logger.info({ breaker: this.key }, 'circuit closed — upstream healthy again');
            return;
        }
        this.record(true);
    }

    onFailure(reason) {
        // The scout died: straight back to open for another full cooldown.
        if (this.state === HALF_OPEN) {
            this.trip(reason);
            return;
        }
        this.record(false);
        this.evaluate(reason);
    }

    record(ok) {
        const now = Date.now();
        this.calls.push({ at: now, ok });
        this.prune(now);
    }

    evaluate(reason) {
        this.prune();
        // Below minCalls the rate is noise — one failed call out of one is 100%,
        // and tripping on that would punish an upstream for a single hiccup.
        if (this.calls.length < this.minCalls) return;

        const failures = this.calls.filter((c) => !c.ok).length;
        if (failures / this.calls.length >= this.failureRate) {
            this.trip(reason, failures);
        }
    }

    trip(reason, failures) {
        this.state = OPEN;
        this.openedAt = Date.now();
        this.probeInFlight = false;
        this.trips += 1;
        const observed = this.calls.length;
        this.calls = [];

        logger.error(
            {
                breaker: this.key,
                failures: failures ?? observed,
                observed,
                openMs: this.openMs,
                trips: this.trips,
                reason
            },
            'circuit OPEN — failing fast, no calls will be attempted'
        );
    }

    stats() {
        this.prune();
        const failures = this.calls.filter((c) => !c.ok).length;
        const total = this.calls.length;

        return {
            key: this.key,
            state: this.state,
            failures,
            calls: total,
            failureRate: total ? Number((failures / total).toFixed(2)) : 0,
            trips: this.trips,
            reopensInMs: this.state === OPEN
                ? Math.max(0, this.openMs - (Date.now() - this.openedAt))
                : null,
            config: {
                windowMs: this.windowMs,
                failureRate: this.failureRate,
                minCalls: this.minCalls,
                openMs: this.openMs
            }
        };
    }
}

// One breaker per upstream, shared across every request — a per-request breaker
// would learn nothing, since the whole point is remembering what other requests
// already discovered. Note this is per process: under cluster each worker keeps
// its own view, so a shared breaker needs Redis.
const registry = new Map();

function breakerFor(key, options) {
    if (!registry.has(key)) registry.set(key, new CircuitBreaker(key, options));
    return registry.get(key);
}

function snapshotBreakers() {
    return [...registry.values()].map((b) => b.stats());
}

function resetBreaker(key) {
    registry.delete(key);
}

module.exports = { breakerFor, snapshotBreakers, resetBreaker, CLOSED, OPEN, HALF_OPEN };
