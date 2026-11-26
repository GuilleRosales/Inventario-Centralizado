const express = require('express');
const { database, authGuard } = require('../../core/container');
const { CatalogosService } = require('./CatalogosService');
const { CatalogosController } = require('./CatalogosController');

const router = express.Router();
const service = new CatalogosService(database);
const controller = new CatalogosController(service);

const GESTIONAR_PRODUCTOS = authGuard.requirePermiso('PRODUCTOS.GESTIONAR');
const REGISTRAR_VENTAS = authGuard.requirePermiso('VENTAS.REGISTRAR');
const REGISTRAR_COMPRAS = authGuard.requirePermiso('COMPRAS.REGISTRAR');

/* Categorías */
router.get('/categorias', controller.handle(controller.listarCategorias));
router.post('/categorias', GESTIONAR_PRODUCTOS, controller.handle(controller.crearCategoria));
router.put('/categorias/:id', GESTIONAR_PRODUCTOS, controller.handle(controller.actualizarCategoria));

/* Productos */
router.get('/productos', controller.handle(controller.listarProductos));
router.post('/productos', GESTIONAR_PRODUCTOS, controller.handle(controller.crearProducto));
router.put('/productos/:id', GESTIONAR_PRODUCTOS, controller.handle(controller.actualizarProducto));

/* Clientes */
router.get('/clientes', controller.handle(controller.listarClientes));
router.post('/clientes', REGISTRAR_VENTAS, controller.handle(controller.crearCliente));
router.put('/clientes/:id', REGISTRAR_VENTAS, controller.handle(controller.actualizarCliente));

/* Proveedores */
router.get('/proveedores', controller.handle(controller.listarProveedores));
router.post('/proveedores', REGISTRAR_COMPRAS, controller.handle(controller.crearProveedor));
router.put('/proveedores/:id', REGISTRAR_COMPRAS, controller.handle(controller.actualizarProveedor));

module.exports = router;
