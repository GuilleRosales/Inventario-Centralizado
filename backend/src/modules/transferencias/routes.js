const express = require('express');
const { database, authGuard } = require('../../core/container');
const { TransferenciasService } = require('./TransferenciasService');
const { TransferenciasController } = require('./TransferenciasController');

const router = express.Router();
const service = new TransferenciasService(database);
const controller = new TransferenciasController(service, authGuard);

const CONSULTAR = authGuard.requireAnyPermiso([
    'TRANSFERENCIAS.CONSULTAR',
    'TRANSFERENCIAS.GESTIONAR'
]);
const GESTIONAR = authGuard.requirePermiso('TRANSFERENCIAS.GESTIONAR');

router.get('/', CONSULTAR, controller.handle(controller.listar));
router.get('/:id', CONSULTAR, controller.handle(controller.obtener));
router.post('/', GESTIONAR, controller.handle(controller.crear));
router.post('/:id/confirmar', GESTIONAR, controller.handle(controller.confirmar));
router.post('/:id/cancelar', GESTIONAR, controller.handle(controller.cancelar));

module.exports = router;
