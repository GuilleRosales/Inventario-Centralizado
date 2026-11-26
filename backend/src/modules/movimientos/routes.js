const express = require('express');
const { database, authGuard } = require('../../core/container');
const { MovimientosService } = require('./MovimientosService');
const { MovimientosController } = require('./MovimientosController');

const router = express.Router();
const service = new MovimientosService(database);
const controller = new MovimientosController(service);

router.get(
    '/',
    authGuard.requirePermiso('MOVIMIENTOS.CONSULTAR'),
    controller.handle(controller.listar)
);

module.exports = router;
