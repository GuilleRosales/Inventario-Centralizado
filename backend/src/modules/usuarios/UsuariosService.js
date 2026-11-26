const { BaseService } = require('../../core/BaseService');
const { Validator } = require('../../core/Validator');
const { AppError } = require('../../core/AppError');
const { sql } = require('../../core/Database');

/**
 * Gestión de roles, permisos, usuarios y sus sucursales asignadas.
 */
class UsuariosService extends BaseService {
    constructor(database, passwordHasher) {
        super(database);
        this.passwordHasher = passwordHasher;
    }

    /* ---------------------------------- ROLES ---------------------------------- */
    async listarRoles() {
        const [rolesResult, permisosResult] = await Promise.all([
            this.query(`SELECT RolID, Nombre, Descripcion, Activo FROM dbo.Rol ORDER BY Nombre`),
            this.query(
                `SELECT rp.RolID, p.PermisoID, p.Codigo, p.Descripcion
                   FROM dbo.RolPermiso rp
                   JOIN dbo.Permiso p ON p.PermisoID = rp.PermisoID
                  ORDER BY p.Codigo`
            )
        ]);

        const permisosPorRol = new Map();
        for (const p of permisosResult.recordset) {
            if (!permisosPorRol.has(p.RolID)) permisosPorRol.set(p.RolID, []);
            permisosPorRol.get(p.RolID).push({
                PermisoID: p.PermisoID,
                Codigo: p.Codigo,
                Descripcion: p.Descripcion
            });
        }

        return rolesResult.recordset.map((rol) => ({
            ...rol,
            permisos: permisosPorRol.get(rol.RolID) || []
        }));
    }

    async listarPermisos() {
        const result = await this.query(
            `SELECT PermisoID, Codigo, Descripcion FROM dbo.Permiso ORDER BY Codigo`
        );
        return result.recordset;
    }

    async crearRol(body) {
        const nombre = Validator.text(body.nombre, 'nombre', { required: true, max: 80 });
        const descripcion = Validator.text(body.descripcion, 'descripción', { max: 250 }) || null;

        const result = await this.query(
            `INSERT INTO dbo.Rol (Nombre, Descripcion)
             OUTPUT INSERTED.RolID, INSERTED.Nombre, INSERTED.Descripcion, INSERTED.Activo
             VALUES (@nombre, @descripcion)`,
            { nombre, descripcion }
        );
        return { ...result.recordset[0], permisos: [] };
    }

    async actualizarRol(id, body) {
        const nombre = Validator.text(body.nombre, 'nombre', { required: true, max: 80 });
        const descripcion = Validator.text(body.descripcion, 'descripción', { max: 250 }) || null;
        const activo = Validator.boolean(body.activo, true);

        const result = await this.query(
            `UPDATE dbo.Rol
                SET Nombre = @nombre, Descripcion = @descripcion, Activo = @activo
              OUTPUT INSERTED.RolID, INSERTED.Nombre, INSERTED.Descripcion, INSERTED.Activo
              WHERE RolID = @id`,
            { id, nombre, descripcion, activo }
        );
        if (!result.recordset[0]) throw new AppError(404, 'El rol no existe.');
        return result.recordset[0];
    }

    async actualizarPermisosRol(rolId, permisos) {
        const lista = Array.isArray(permisos) ? permisos : [];
        const ids = [...new Set(
            lista.map((p) => Number(p)).filter((n) => Number.isInteger(n) && n > 0)
        )];

        const roleExists = await this.query(
            'SELECT 1 AS existe FROM dbo.Rol WHERE RolID = @rolId',
            { rolId }
        );
        if (!roleExists.recordset[0]) throw new AppError(404, 'El rol no existe.');

        await this.transaction(async (tx) => {
            await this.queryTx(tx, 'DELETE FROM dbo.RolPermiso WHERE RolID = @rolId', {
                rolId: { type: sql.Int, value: rolId }
            });

            for (const permisoId of ids) {
                await this.queryTx(
                    tx,
                    `INSERT INTO dbo.RolPermiso (RolID, PermisoID)
                     VALUES (@rolId, @permisoId)`,
                    {
                        rolId: { type: sql.Int, value: rolId },
                        permisoId: { type: sql.Int, value: permisoId }
                    }
                );
            }
        });
    }

    /* --------------------------------- USUARIOS -------------------------------- */
    async listarUsuarios() {
        const [usuarios, roles, sucursales] = await Promise.all([
            this.query(`SELECT UsuarioID, Nombre, Correo, Activo, FechaCreacion
                          FROM dbo.Usuario ORDER BY Nombre`),
            this.query(`SELECT ur.UsuarioID, r.RolID, r.Nombre
                          FROM dbo.UsuarioRol ur
                          JOIN dbo.Rol r ON r.RolID = ur.RolID
                         ORDER BY r.Nombre`),
            this.query(`SELECT us.UsuarioID, s.SucursalID, s.CodigoSucursal, s.Nombre, us.EsPrincipal
                          FROM dbo.UsuarioSucursal us
                          JOIN dbo.Sucursal s ON s.SucursalID = us.SucursalID
                         ORDER BY us.EsPrincipal DESC, s.Nombre`)
        ]);

        const rolesPorUsuario = new Map();
        for (const r of roles.recordset) {
            if (!rolesPorUsuario.has(r.UsuarioID)) rolesPorUsuario.set(r.UsuarioID, []);
            rolesPorUsuario.get(r.UsuarioID).push({ RolID: r.RolID, Nombre: r.Nombre });
        }

        const sucursalesPorUsuario = new Map();
        for (const s of sucursales.recordset) {
            if (!sucursalesPorUsuario.has(s.UsuarioID)) sucursalesPorUsuario.set(s.UsuarioID, []);
            sucursalesPorUsuario.get(s.UsuarioID).push({
                SucursalID: s.SucursalID,
                CodigoSucursal: s.CodigoSucursal,
                Nombre: s.Nombre,
                EsPrincipal: s.EsPrincipal
            });
        }

        return usuarios.recordset.map((usuario) => ({
            ...usuario,
            roles: rolesPorUsuario.get(usuario.UsuarioID) || [],
            sucursales: sucursalesPorUsuario.get(usuario.UsuarioID) || []
        }));
    }

    async crearUsuario(body) {
        const nombre = Validator.text(body.nombre, 'nombre', { required: true, max: 150 });
        const correo = Validator.text(body.correo, 'correo', { required: true, max: 150 }).toLowerCase();
        const password = String(body.password || '');
        const rolId = Validator.integer(body.rolId, 'rol', { required: true });
        const sucursalId = Validator.integer(body.sucursalId, 'sucursal');

        if (password.length < 6) {
            throw new AppError(400, 'La contraseña debe tener al menos 6 caracteres.');
        }

        const result = await this.execute(
            'dbo.usp_CrearUsuario',
            {
                Nombre: { type: sql.NVarChar(150), value: nombre },
                Correo: { type: sql.NVarChar(150), value: correo },
                PasswordHash: { type: sql.NVarChar(255), value: this.passwordHasher.hash(password) },
                RolID: { type: sql.Int, value: rolId },
                SucursalID: { type: sql.Int, value: sucursalId }
            },
            { UsuarioID: sql.Int }
        );

        return { UsuarioID: result.output.UsuarioID };
    }

    async actualizarUsuario(id, body, actorId) {
        const nombre = Validator.text(body.nombre, 'nombre', { required: true, max: 150 });
        const correo = Validator.text(body.correo, 'correo', { required: true, max: 150 }).toLowerCase();
        const activo = Validator.boolean(body.activo, true);
        const password = String(body.password || '');

        const existe = await this.query(
            'SELECT UsuarioID FROM dbo.Usuario WHERE UsuarioID = @id',
            { id }
        );
        if (!existe.recordset[0]) throw new AppError(404, 'El usuario no existe.');

        if (id === actorId && !activo) {
            throw new AppError(400, 'No puede desactivar su propio usuario.');
        }
        if (password && password.length < 6) {
            throw new AppError(400, 'La contraseña debe tener al menos 6 caracteres.');
        }

        if (password) {
            await this.query(
                `UPDATE dbo.Usuario
                    SET Nombre = @nombre, Correo = @correo, Activo = @activo,
                        PasswordHash = @passwordHash
                  WHERE UsuarioID = @id`,
                { id, nombre, correo, activo, passwordHash: this.passwordHasher.hash(password) }
            );
        } else {
            await this.query(
                `UPDATE dbo.Usuario
                    SET Nombre = @nombre, Correo = @correo, Activo = @activo
                  WHERE UsuarioID = @id`,
                { id, nombre, correo, activo }
            );
        }
    }

    async asignarRol(usuarioId, rolId, asignadoPor) {
        await this.query(
            `EXEC dbo.usp_AsignarRolUsuario @UsuarioID = @usuarioId,
                                           @RolID = @rolId,
                                           @AsignadoPorUsuarioID = @asignadoPor`,
            { usuarioId, rolId, asignadoPor }
        );
    }

    async quitarRol(usuarioId, rolId) {
        const count = await this.query(
            'SELECT COUNT(*) AS total FROM dbo.UsuarioRol WHERE UsuarioID = @usuarioId',
            { usuarioId }
        );
        if (count.recordset[0].total <= 1) {
            throw new AppError(400, 'El usuario debe conservar al menos un rol.');
        }

        await this.query(
            'DELETE FROM dbo.UsuarioRol WHERE UsuarioID = @usuarioId AND RolID = @rolId',
            { usuarioId, rolId }
        );
    }

    async asignarSucursal(usuarioId, sucursalId, esPrincipal = false) {
        await this.transaction(async (tx) => {
            if (esPrincipal) {
                await this.queryTx(
                    tx,
                    'UPDATE dbo.UsuarioSucursal SET EsPrincipal = 0 WHERE UsuarioID = @usuarioId',
                    { usuarioId: { type: sql.Int, value: usuarioId } }
                );
            }

            const exists = await this.queryTx(
                tx,
                `SELECT 1 AS existe FROM dbo.UsuarioSucursal
                  WHERE UsuarioID = @usuarioId AND SucursalID = @sucursalId`,
                {
                    usuarioId: { type: sql.Int, value: usuarioId },
                    sucursalId: { type: sql.Int, value: sucursalId }
                }
            );

            const params = {
                usuarioId: { type: sql.Int, value: usuarioId },
                sucursalId: { type: sql.Int, value: sucursalId },
                esPrincipal: { type: sql.Bit, value: esPrincipal ? 1 : 0 }
            };

            if (exists.recordset[0]) {
                await this.queryTx(
                    tx,
                    `UPDATE dbo.UsuarioSucursal SET EsPrincipal = @esPrincipal
                      WHERE UsuarioID = @usuarioId AND SucursalID = @sucursalId`,
                    params
                );
            } else {
                await this.queryTx(
                    tx,
                    `INSERT INTO dbo.UsuarioSucursal (UsuarioID, SucursalID, EsPrincipal)
                     VALUES (@usuarioId, @sucursalId, @esPrincipal)`,
                    params
                );
            }
        });
    }

    async quitarSucursal(usuarioId, sucursalId) {
        await this.query(
            'DELETE FROM dbo.UsuarioSucursal WHERE UsuarioID = @usuarioId AND SucursalID = @sucursalId',
            { usuarioId, sucursalId }
        );
    }
}

module.exports = { UsuariosService };
