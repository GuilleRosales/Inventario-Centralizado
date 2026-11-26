const express = require('express');
const { database, authGuard } = require('../../core/container');
const { VentasService } = require('./VentasService');
const { VentasController } = require('./VentasController');

const router = express.Router();
const service = new VentasService(database);
const controller = new VentasController(service, authGuard);

const CONSULTAR = authGuard.requireAnyPermiso(['VENTAS.CONSULTAR', 'VENTAS.REGISTRAR']);
const REGISTRAR = authGuard.requirePermiso('VENTAS.REGISTRAR');

router.get('/', CONSULTAR, controller.handle(controller.listar));
router.get('/:id', CONSULTAR, controller.handle(controller.obtener));
router.post('/', REGISTRAR, controller.handle(controller.crear));
router.post('/:id/confirmar', REGISTRAR, controller.handle(controller.confirmar));
router.post('/:id/cancelar', REGISTRAR, controller.handle(controller.cancelar));

module.exports = router;
