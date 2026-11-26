const { BaseController } = require('../../core/BaseController');
const { Validator } = require('../../core/Validator');

/**
 * Controlador HTTP de compras.
 */
class ComprasController extends BaseController {
    constructor(service, authGuard) {
        super(service);
        this.authGuard = authGuard;
    }

    async listar(req, res) {
        const datos = await this.service.listar({
            desde: Validator.date(req.query.desde, 'desde'),
            hasta: Validator.date(req.query.hasta, 'hasta'),
            sucursalId: Validator.integer(req.query.sucursalId, 'sucursal'),
            proveedorId: Validator.integer(req.query.proveedorId, 'proveedor'),
            estado: Validator.text(req.query.estado, 'estado', { max: 15 }).toUpperCase()
        });
        res.json({ datos });
    }

    async obtener(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json(await this.service.obtener(id));
    }

    async crear(req, res) {
        const compra = this.service.preparar(req.body);
        this.authGuard.exigirSucursal(req, compra.sucursalDestinoId, 'sucursal destino');
        res.status(201).json({ dato: await this.service.crear(compra, req.user.sub) });
    }

    async confirmar(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        const sucursalId = await this.service.sucursalDeCompra(id);
        this.authGuard.exigirSucursal(req, sucursalId, 'sucursal de la compra');
        await this.service.confirmar(id, req.user.sub);
        res.json({ mensaje: 'Compra recibida. Las existencias fueron actualizadas.' });
    }

    async cancelar(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        const sucursalId = await this.service.sucursalDeCompra(id, { soloRegistrada: true });
        this.authGuard.exigirSucursal(req, sucursalId, 'sucursal de la compra');
        await this.service.cancelar(id);
        res.json({ mensaje: 'Compra cancelada.' });
    }
}

module.exports = { ComprasController };
