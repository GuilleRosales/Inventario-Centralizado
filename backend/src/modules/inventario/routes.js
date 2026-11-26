const express = require('express');
const { database, authGuard } = require('../../core/container');
const { InventarioService } = require('./InventarioService');
const { InventarioController } = require('./InventarioController');

const router = express.Router();
const service = new InventarioService(database);
const controller = new InventarioController(service, authGuard);

const CONSULTAR = authGuard.requirePermiso('INVENTARIO.CONSULTAR');
const AJUSTAR = authGuard.requirePermiso('INVENTARIO.AJUSTAR');

router.get('/', CONSULTAR, controller.handle(controller.listar));
router.get('/bajo-stock', CONSULTAR, controller.handle(controller.bajoStock));
router.get('/global', CONSULTAR, controller.handle(controller.disponibilidadGlobal));
router.post('/ajuste', AJUSTAR, controller.handle(controller.ajustar));
router.get('/alertas', CONSULTAR, controller.handle(controller.listarAlertas));
router.post('/alertas/:id/atender', AJUSTAR, controller.handle(controller.atenderAlerta));

module.exports = router;
