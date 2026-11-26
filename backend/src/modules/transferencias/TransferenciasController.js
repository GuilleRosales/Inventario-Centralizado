const { BaseController } = require('../../core/BaseController');
const { Validator } = require('../../core/Validator');

/**
 * Controlador HTTP de transferencias entre sucursales.
 */
class TransferenciasController extends BaseController {
    constructor(service, authGuard) {
        super(service);
        this.authGuard = authGuard;
    }

    async listar(req, res) {
        const datos = await this.service.listar({
            desde: Validator.date(req.query.desde, 'desde'),
            hasta: Validator.date(req.query.hasta, 'hasta'),
            origenId: Validator.integer(req.query.origenId, 'sucursal origen'),
            destinoId: Validator.integer(req.query.destinoId, 'sucursal destino'),
            estado: Validator.text(req.query.estado, 'estado', { max: 15 }).toUpperCase()
        });
        res.json({ datos });
    }

    async obtener(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json(await this.service.obtener(id));
    }

    async crear(req, res) {
        const transferencia = this.service.preparar(req.body);
        this.authGuard.exigirSucursal(req, transferencia.sucursalOrigenId, 'sucursal origen');
        res.status(201).json({ dato: await this.service.crear(transferencia, req.user.sub) });
    }

    async confirmar(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        const sucursales = await this.service.sucursalesDeTransferencia(id);
        this.authGuard.exigirAlgunaSucursal(req, sucursales, 'sucursal de la transferencia');
        await this.service.confirmar(id, req.user.sub);
        res.json({ mensaje: 'Transferencia confirmada. Se actualizaron ambas sucursales.' });
    }

    async cancelar(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        const sucursales = await this.service.sucursalesDeTransferencia(id, { soloSolicitada: true });
        this.authGuard.exigirAlgunaSucursal(req, sucursales, 'sucursal de la transferencia');
        await this.service.cancelar(id);
        res.json({ mensaje: 'Transferencia cancelada.' });
    }
}

module.exports = { TransferenciasController };
