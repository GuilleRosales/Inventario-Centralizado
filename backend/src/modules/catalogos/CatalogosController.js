const { BaseController } = require('../../core/BaseController');
const { Validator } = require('../../core/Validator');

/**
 * Controlador HTTP de catálogos maestros.
 */
class CatalogosController extends BaseController {
    /* ------------------------------- CATEGORÍAS ------------------------------- */
    async listarCategorias(req, res) {
        const datos = await this.service.listarCategorias({
            incluirInactivas: Validator.boolean(req.query.incluirInactivas, false)
        });
        res.json({ datos });
    }

    async crearCategoria(req, res) {
        res.status(201).json({ dato: await this.service.crearCategoria(req.body) });
    }

    async actualizarCategoria(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json({ dato: await this.service.actualizarCategoria(id, req.body) });
    }

    /* --------------------------------- PRODUCTOS ------------------------------- */
    async listarProductos(req, res) {
        const datos = await this.service.listarProductos({
            buscar: Validator.text(req.query.buscar, 'búsqueda', { max: 100 }),
            categoriaId: Validator.integer(req.query.categoriaId, 'categoría'),
            incluirInactivos: Validator.boolean(req.query.incluirInactivos, false)
        });
        res.json({ datos });
    }

    async crearProducto(req, res) {
        res.status(201).json({ dato: await this.service.crearProducto(req.body) });
    }

    async actualizarProducto(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json({ dato: await this.service.actualizarProducto(id, req.body) });
    }

    /* --------------------------------- CLIENTES -------------------------------- */
    async listarClientes(req, res) {
        const datos = await this.service.listarClientes({
            buscar: Validator.text(req.query.buscar, 'búsqueda', { max: 100 })
        });
        res.json({ datos });
    }

    async crearCliente(req, res) {
        res.status(201).json({ dato: await this.service.crearCliente(req.body) });
    }

    async actualizarCliente(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json({ dato: await this.service.actualizarCliente(id, req.body) });
    }

    /* -------------------------------- PROVEEDORES ------------------------------ */
    async listarProveedores(req, res) {
        const datos = await this.service.listarProveedores({
            buscar: Validator.text(req.query.buscar, 'búsqueda', { max: 100 })
        });
        res.json({ datos });
    }

    async crearProveedor(req, res) {
        res.status(201).json({ dato: await this.service.crearProveedor(req.body) });
    }

    async actualizarProveedor(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json({ dato: await this.service.actualizarProveedor(id, req.body) });
    }
}

module.exports = { CatalogosController };
