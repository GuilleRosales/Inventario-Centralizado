const express = require('express');
const { database, passwordHasher, authGuard } = require('../../core/container');
const { UsuariosService } = require('./UsuariosService');
const { UsuariosController } = require('./UsuariosController');

const router = express.Router();
const service = new UsuariosService(database, passwordHasher);
const controller = new UsuariosController(service);

const GESTIONAR_USUARIOS = authGuard.requirePermiso('USUARIOS.GESTIONAR');
const GESTIONAR_ROLES = authGuard.requirePermiso('ROLES.GESTIONAR');
const GESTIONAR_UBICACIONES = authGuard.requirePermiso('UBICACIONES.GESTIONAR');
const CONSULTAR_EQUIPO = authGuard.requireAnyPermiso(['USUARIOS.GESTIONAR', 'ROLES.GESTIONAR']);

/* Roles y permisos */
router.get('/roles', CONSULTAR_EQUIPO, controller.handle(controller.listarRoles));
router.get('/permisos', CONSULTAR_EQUIPO, controller.handle(controller.listarPermisos));
router.post('/roles', GESTIONAR_ROLES, controller.handle(controller.crearRol));
router.put('/roles/:id', GESTIONAR_ROLES, controller.handle(controller.actualizarRol));
router.put('/roles/:id/permisos', GESTIONAR_ROLES, controller.handle(controller.actualizarPermisosRol));

/* Usuarios */
router.get('/usuarios', GESTIONAR_USUARIOS, controller.handle(controller.listarUsuarios));
router.post('/usuarios', GESTIONAR_USUARIOS, controller.handle(controller.crearUsuario));
router.put('/usuarios/:id', GESTIONAR_USUARIOS, controller.handle(controller.actualizarUsuario));
router.post('/usuarios/:id/roles', GESTIONAR_USUARIOS, controller.handle(controller.asignarRol));
router.delete('/usuarios/:id/roles/:rolId', GESTIONAR_USUARIOS, controller.handle(controller.quitarRol));
router.post('/usuarios/:id/sucursales', GESTIONAR_UBICACIONES, controller.handle(controller.asignarSucursal));
router.delete('/usuarios/:id/sucursales/:sucursalId', GESTIONAR_UBICACIONES, controller.handle(controller.quitarSucursal));

module.exports = router;
