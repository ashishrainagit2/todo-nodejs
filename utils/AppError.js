// Errors we raise on purpose. isOperational tells the global handler the message
// was written for the client, so anything without it is treated as a bug and hidden.
// code is a stable machine contract (ERR_TASK_NOT_FOUND). message is for humans and may change.
class AppError extends Error {
    constructor(message, statusCode = 500, errors = [], code = 'ERR_GENERIC', cause) {
        // Node 16+: { cause } links this error to the original (ECONNRESET, DNS, TLS…).
        // Client still sees only this.message. Logs can walk .cause for the crime scene.
        if (cause !== undefined) {
            super(message, { cause });
        } else {
            super(message);
        }

        this.statusCode = statusCode;
        this.errors = errors;
        this.code = code;
        this.isOperational = true;

        // drop the constructor call from the stack so it points at the throw site
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
