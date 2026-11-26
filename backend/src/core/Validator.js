const { AppError } = require('./AppError');

/**
 * Validaciones y conversiones de entrada reutilizadas por los servicios.
 */
class Validator {
    static text(value, name, { required = false, max = 300 } = {}) {
        const clean = String(value ?? '').trim();
        if (required && !clean) throw new AppError(400, `El campo "${name}" es obligatorio.`);
        if (clean.length > max) throw new AppError(400, `El campo "${name}" supera ${max} caracteres.`);
        return clean;
    }

    static integer(value, name, { required = false, min = null, max = null } = {}) {
        if (value === undefined || value === null || value === '') {
            if (required) throw new AppError(400, `El campo "${name}" es obligatorio.`);
            return null;
        }
        const number = Number(value);
        if (!Number.isInteger(number)) {
            throw new AppError(400, `El campo "${name}" debe ser un número entero.`);
        }
        if (min !== null && number < min) {
            throw new AppError(400, `El campo "${name}" debe ser mayor o igual a ${min}.`);
        }
        if (max !== null && number > max) {
            throw new AppError(400, `El campo "${name}" debe ser menor o igual a ${max}.`);
        }
        return number;
    }

    static decimal(value, name, { required = false, min = 0 } = {}) {
        if (value === undefined || value === null || value === '') {
            if (required) throw new AppError(400, `El campo "${name}" es obligatorio.`);
            return null;
        }
        const number = Number(value);
        if (!Number.isFinite(number)) {
            throw new AppError(400, `El campo "${name}" debe ser un número.`);
        }
        if (min !== null && number < min) {
            throw new AppError(400, `El campo "${name}" no puede ser menor a ${min}.`);
        }
        return Number(number.toFixed(2));
    }

    static boolean(value, fallback = false) {
        if (value === undefined || value === null || value === '') return fallback;
        if (typeof value === 'boolean') return value;
        return ['1', 'true', 'si', 'sí'].includes(String(value).toLowerCase());
    }

    static pagination(value, fallback = 50, max = 500) {
        const number = Number(value);
        if (!Number.isInteger(number) || number <= 0) return fallback;
        return Math.min(number, max);
    }

    static date(value, name) {
        const clean = String(value || '').trim();
        if (!clean) return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
            throw new AppError(400, `La fecha "${name}" debe tener el formato AAAA-MM-DD.`);
        }
        return clean;
    }

    static sqlErrorMessage(error) {
        if (error?.number === 2627 || error?.number === 2601) {
            return 'Ya existe un registro con esos datos. Verifique los valores únicos.';
        }
        if (error?.number === 547) {
            return 'No se puede completar la operación porque hay registros relacionados.';
        }
        if (error?.number === 515) {
            return 'Faltan datos obligatorios para completar la operación.';
        }
        if (error?.number === 8114 || error?.number === 245) {
            return 'Uno de los valores enviados no tiene el formato esperado.';
        }
        if (error?.number >= 50000) {
            return error.message;
        }
        return null;
    }
}

module.exports = { Validator };
