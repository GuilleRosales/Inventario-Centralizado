const { BaseController } = require('../../core/BaseController');
const { Validator } = require('../../core/Validator');

/**
 * Controlador HTTP de roles, permisos y usuarios.
 */
class UsuariosController extends BaseController {
    /* ---------------------------------- ROLES ---------------------------------- */
    async listarRoles(req, res) {
        res.json({ datos: await this.service.listarRoles() });
    }

    async listarPermisos(req, res) {
        res.json({ datos: await this.service.listarPermisos() });
    }

    async crearRol(req, res) {
        res.status(201).json({ dato: await this.service.crearRol(req.body) });
    }

    async actualizarRol(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json({ dato: await this.service.actualizarRol(id, req.body) });
    }

    async actualizarPermisosRol(req, res) {
        const rolId = Validator.integer(req.params.id, 'id', { required: true });
        await this.service.actualizarPermisosRol(rolId, req.body.permisos);
        res.json({ mensaje: 'Permisos del rol actualizados.' });
    }

    /* --------------------------------- USUARIOS -------------------------------- */
    async listarUsuarios(req, res) {
        res.json({ datos: await this.service.listarUsuarios() });
    }

    async crearUsuario(req, res) {
        res.status(201).json({ dato: await this.service.crearUsuario(req.body) });
    }

    async actualizarUsuario(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        await this.service.actualizarUsuario(id, req.body, req.user.sub);
        res.json({ mensaje: 'Usuario actualizado.' });
    }

    async asignarRol(req, res) {
        const usuarioId = Validator.integer(req.params.id, 'id', { required: true });
        const rolId = Validator.integer(req.body.rolId, 'rol', { required: true });
        await this.service.asignarRol(usuarioId, rolId, req.user.sub);
        res.status(201).json({ mensaje: 'Rol asignado.' });
    }

    async quitarRol(req, res) {
        const usuarioId = Validator.integer(req.params.id, 'id', { required: true });
        const rolId = Validator.integer(req.params.rolId, 'rol', { required: true });
        await this.service.quitarRol(usuarioId, rolId);
        res.json({ mensaje: 'Rol removido.' });
    }

    async asignarSucursal(req, res) {
        const usuarioId = Validator.integer(req.params.id, 'id', { required: true });
        const sucursalId = Validator.integer(req.body.sucursalId, 'sucursal', { required: true });
        const esPrincipal = Validator.boolean(req.body.esPrincipal, false);
        await this.service.asignarSucursal(usuarioId, sucursalId, esPrincipal);
        res.status(201).json({ mensaje: 'Sucursal asignada.' });
    }

    async quitarSucursal(req, res) {
        const usuarioId = Validator.integer(req.params.id, 'id', { required: true });
        const sucursalId = Validator.integer(req.params.sucursalId, 'sucursal', { required: true });
        await this.service.quitarSucursal(usuarioId, sucursalId);
        res.json({ mensaje: 'Sucursal removida.' });
    }
}

module.exports = { UsuariosController };
