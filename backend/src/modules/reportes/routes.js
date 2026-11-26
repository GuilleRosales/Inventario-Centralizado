const express = require('express');
const { database, authGuard } = require('../../core/container');
const { ReportesService } = require('./ReportesService');
const { ReportesController } = require('./ReportesController');

const router = express.Router();
const service = new ReportesService(database);
const controller = new ReportesController(service);

const REPORTES = authGuard.requirePermiso('REPORTES.GENERAR');

router.get('/ventas', REPORTES, controller.handle(controller.ventas));
router.get('/compras', REPORTES, controller.handle(controller.compras));
router.get('/transferencias', REPORTES, controller.handle(controller.transferencias));
router.get('/inventario-valorado', REPORTES, controller.handle(controller.inventarioValorado));

module.exports = router;
