/**
 * Base para los controladores HTTP.
 * Vincula automáticamente los métodos al objeto y captura errores async.
 */
class BaseController {
    constructor(service) {
        this.service = service;
        for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
            if (name === 'constructor') continue;
            const method = this[name];
            if (typeof method === 'function') this[name] = method.bind(this);
        }
    }

    handle(handler) {
        return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
    }
}

module.exports = { BaseController };
