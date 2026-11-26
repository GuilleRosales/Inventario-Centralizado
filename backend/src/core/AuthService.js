const { AppError } = require('./AppError');

/**
 * Servicio de autenticación. Concentra la validación de credenciales,
 * la carga de roles/permisos y la emisión de tokens.
 */
class AuthService {
    constructor(database, passwordHasher, tokenService) {
        this.db = database;
        this.passwordHasher = passwordHasher;
        this.tokenService = tokenService;
    }

    verifyToken(token) {
        return this.tokenService.verify(token);
    }

    async assertActive(usuarioId) {
        const result = await this.db.query(
            'SELECT Activo FROM dbo.Usuario WHERE UsuarioID = @usuarioId',
            { usuarioId }
        );
        if (!result.recordset[0] || !result.recordset[0].Activo) {
            throw new AppError(401, 'El usuario ya no está activo.');
        }
    }

    async login(correoInput, passwordInput) {
        const correo = String(correoInput || '').trim().toLowerCase();
        const password = String(passwordInput || '');

        if (!correo || !password) {
            throw new AppError(400, 'El correo y la contraseña son obligatorios.');
        }

        const result = await this.db.query(
            `SELECT u.UsuarioID, u.Nombre, u.Correo, u.PasswordHash, u.Activo,
                    r.RolID, r.Nombre AS Rol, p.Codigo AS Permiso
               FROM dbo.Usuario u
               LEFT JOIN dbo.UsuarioRol ur ON ur.UsuarioID = u.UsuarioID
               LEFT JOIN dbo.Rol r ON r.RolID = ur.RolID AND r.Activo = 1
               LEFT JOIN dbo.RolPermiso rp ON rp.RolID = r.RolID
               LEFT JOIN dbo.Permiso p ON p.PermisoID = rp.PermisoID
              WHERE LOWER(u.Correo) = @correo`,
            { correo }
        );

        const rows = result.recordset;
        if (rows.length === 0) {
            throw new AppError(401, 'Credenciales inválidas.');
        }

        const user = rows[0];
        if (!user.Activo) {
            throw new AppError(403, 'El usuario está inactivo. Contacte al administrador.');
        }
        if (!this.passwordHasher.verify(password, user.PasswordHash)) {
            throw new AppError(401, 'Credenciales inválidas.');
        }

        const roles = [...new Set(rows.map((row) => row.Rol).filter(Boolean))];
        if (roles.length === 0) {
            throw new AppError(403, 'El usuario no tiene roles activos asignados.');
        }
        const permisos = [...new Set(rows.map((row) => row.Permiso).filter(Boolean))];

        const sucursales = await this.db.query(
            `SELECT s.SucursalID, s.CodigoSucursal, s.Nombre, us.EsPrincipal
               FROM dbo.UsuarioSucursal us
               JOIN dbo.Sucursal s ON s.SucursalID = us.SucursalID
              WHERE us.UsuarioID = @usuarioId
                AND s.Activa = 1
              ORDER BY us.EsPrincipal DESC, s.Nombre`,
            { usuarioId: user.UsuarioID }
        );

        const usuario = {
            sub: user.UsuarioID,
            nombre: user.Nombre,
            correo: user.Correo,
            roles,
            permisos,
            sucursales: sucursales.recordset
        };

        return {
            token: this.tokenService.sign(usuario),
            usuario
        };
    }
}

module.exports = { AuthService };
