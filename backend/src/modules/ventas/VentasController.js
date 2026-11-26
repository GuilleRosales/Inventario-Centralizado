const { BaseController } = require('../../core/BaseController');
const { Validator } = require('../../core/Validator');

/**
 * Controlador HTTP de ventas.
 */
class VentasController extends BaseController {
    constructor(service, authGuard) {
        super(service);
        this.authGuard = authGuard;
    }

    async listar(req, res) {
        const datos = await this.service.listar({
            desde: Validator.date(req.query.desde, 'desde'),
            hasta: Validator.date(req.query.hasta, 'hasta'),
            sucursalId: Validator.integer(req.query.sucursalId, 'sucursal'),
            clienteId: Validator.integer(req.query.clienteId, 'cliente'),
            estado: Validator.text(req.query.estado, 'estado', { max: 15 }).toUpperCase()
        });
        res.json({ datos });
    }

    async obtener(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json(await this.service.obtener(id));
    }

    async crear(req, res) {
        const venta = this.service.preparar(req.body);
        this.authGuard.exigirSucursal(req, venta.sucursalId);
        res.status(201).json({ dato: await this.service.crear(venta, req.user.sub) });
    }

    async confirmar(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        const sucursalId = await this.service.sucursalDeVenta(id);
        this.authGuard.exigirSucursal(req, sucursalId, 'sucursal de la venta');
        await this.service.confirmar(id, req.user.sub);
        res.json({ mensaje: 'Venta confirmada. Las existencias fueron descontadas.' });
    }

    async cancelar(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        const sucursalId = await this.service.sucursalDeVenta(id, { soloRegistrada: true });
        this.authGuard.exigirSucursal(req, sucursalId, 'sucursal de la venta');
        await this.service.cancelar(id);
        res.json({ mensaje: 'Venta cancelada.' });
    }
}

module.exports = { VentasController };
