const { AppError } = require('./AppError');

/**
 * Middleware y reglas de autorización basadas en permisos y sucursales.
 */
class AuthGuard {
    constructor(authService) {
        this.authService = authService;
    }

    authenticate() {
        return async (req, res, next) => {
            try {
                const header = req.headers.authorization || '';
                const token = header.startsWith('Bearer ') ? header.slice(7) : null;
                if (!token) throw new AppError(401, 'Debe iniciar sesión.');

                const payload = this.authService.verifyToken(token);
                if (!payload) throw new AppError(401, 'La sesión ha expirado o no es válida.');

                await this.authService.assertActive(payload.sub);
                req.user = payload;
                next();
            } catch (error) {
                next(error);
            }
        };
    }

    requirePermiso(codigo) {
        return (req, res, next) => {
            const permisos = req.user?.permisos || [];
            if (permisos.includes(codigo)) return next();
            return next(new AppError(403, `No tiene el permiso ${codigo}.`));
        };
    }

    requireAnyPermiso(codigos) {
        return (req, res, next) => {
            const permisos = req.user?.permisos || [];
            if (codigos.some((codigo) => permisos.includes(codigo))) return next();
            return next(new AppError(
                403,
                `No tiene ninguno de los permisos requeridos: ${codigos.join(', ')}.`
            ));
        };
    }

    /** Sucursales asignadas al usuario. Una lista vacía significa acceso a todas. */
    sucursalesAsignadas(req) {
        return (req.user?.sucursales || [])
            .map((sucursal) => Number(sucursal.SucursalID))
            .filter((id) => Number.isInteger(id));
    }

    tieneAccesoTotal(req) {
        return this.sucursalesAsignadas(req).length === 0;
    }

    puedeOperarSucursal(req, sucursalId) {
        if (this.tieneAccesoTotal(req)) return true;
        return this.sucursalesAsignadas(req).includes(Number(sucursalId));
    }

    /** Impide que un usuario con sucursales asignadas escriba en otra sucursal. */
    exigirSucursal(req, sucursalId, etiqueta = 'sucursal') {
        if (!this.puedeOperarSucursal(req, sucursalId)) {
            throw new AppError(403, `Su usuario no tiene acceso a la ${etiqueta} seleccionada.`);
        }
    }

    /** Variante para operaciones que afectan a dos sucursales (transferencias). */
    exigirAlgunaSucursal(req, sucursalIds, etiqueta = 'sucursal') {
        if (this.tieneAccesoTotal(req)) return;
        const asignadas = this.sucursalesAsignadas(req);
        if (!sucursalIds.some((id) => asignadas.includes(Number(id)))) {
            throw new AppError(403, `Su usuario no tiene acceso a la ${etiqueta} de esta operación.`);
        }
    }
}

module.exports = { AuthGuard };
