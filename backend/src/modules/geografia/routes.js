const express = require('express');
const { database, authGuard } = require('../../core/container');
const { GeografiaService } = require('./GeografiaService');
const { GeografiaController } = require('./GeografiaController');

const router = express.Router();
const service = new GeografiaService(database);
const controller = new GeografiaController(service);
const GESTIONAR = authGuard.requirePermiso('UBICACIONES.GESTIONAR');

router.get('/paises', controller.handle(controller.listarPaises));
router.post('/paises', GESTIONAR, controller.handle(controller.crearPais));
router.put('/paises/:id', GESTIONAR, controller.handle(controller.actualizarPais));

router.get('/divisiones', controller.handle(controller.listarDivisiones));
router.post('/divisiones', GESTIONAR, controller.handle(controller.crearDivision));
router.put('/divisiones/:id', GESTIONAR, controller.handle(controller.actualizarDivision));

router.get('/ciudades', controller.handle(controller.listarCiudades));
router.post('/ciudades', GESTIONAR, controller.handle(controller.crearCiudad));
router.put('/ciudades/:id', GESTIONAR, controller.handle(controller.actualizarCiudad));

router.get('/sucursales', controller.handle(controller.listarSucursales));
router.post('/sucursales', GESTIONAR, controller.handle(controller.crearSucursal));
router.put('/sucursales/:id', GESTIONAR, controller.handle(controller.actualizarSucursal));

module.exports = router;
