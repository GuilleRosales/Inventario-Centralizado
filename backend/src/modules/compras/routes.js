const express = require('express');
const { database, authGuard } = require('../../core/container');
const { ComprasService } = require('./ComprasService');
const { ComprasController } = require('./ComprasController');

const router = express.Router();
const service = new ComprasService(database);
const controller = new ComprasController(service, authGuard);

const CONSULTAR = authGuard.requireAnyPermiso(['COMPRAS.CONSULTAR', 'COMPRAS.REGISTRAR']);
const REGISTRAR = authGuard.requirePermiso('COMPRAS.REGISTRAR');

router.get('/', CONSULTAR, controller.handle(controller.listar));
router.get('/:id', CONSULTAR, controller.handle(controller.obtener));
router.post('/', REGISTRAR, controller.handle(controller.crear));
router.post('/:id/confirmar', REGISTRAR, controller.handle(controller.confirmar));
router.post('/:id/cancelar', REGISTRAR, controller.handle(controller.cancelar));

module.exports = router;
