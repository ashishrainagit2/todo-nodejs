// Errors we raise on purpose. isOperational tells the global handler the message
// was written for the client, so anything without it is treated as a bug and hidden.
class AppError extends Error {
    constructor(message, statusCode, errors = []) {
        super(message);

        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;

        // drop the constructor call from the stack so it points at the throw site
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
