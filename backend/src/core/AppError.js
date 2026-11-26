/**
 * Error de aplicación con código HTTP.
 * Centraliza los errores de validación, permisos y recursos no encontrados.
 */
class AppError extends Error {
    constructor(status, message, details = null) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.details = details;
    }
}

module.exports = { AppError };
