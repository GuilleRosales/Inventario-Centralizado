const express = require('express');
const { database, authGuard } = require('../../core/container');
const { DashboardService } = require('./DashboardService');
const { DashboardController } = require('./DashboardController');

const router = express.Router();
const service = new DashboardService(database);
const controller = new DashboardController(service);

router.get('/', authGuard.requirePermiso('INVENTARIO.CONSULTAR'), controller.handle(controller.resumen));

module.exports = router;
