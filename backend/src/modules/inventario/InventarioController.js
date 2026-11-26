const { BaseController } = require('../../core/BaseController');
const { Validator } = require('../../core/Validator');
const { AppError } = require('../../core/AppError');

/**
 * Controlador HTTP de inventario, ajustes y alertas.
 */
class InventarioController extends BaseController {
    constructor(service, authGuard) {
        super(service);
        this.authGuard = authGuard;
    }

    async listar(req, res) {
        const datos = await this.service.listar({
            sucursalId: Validator.integer(req.query.sucursalId, 'sucursal'),
            pais: Validator.text(req.query.pais, 'país', { max: 100 }),
            buscar: Validator.text(req.query.buscar, 'búsqueda', { max: 100 }),
            soloBajoStock: Validator.boolean(req.query.soloBajoStock, false)
        });
        res.json({ datos });
    }

    async bajoStock(req, res) {
        res.json({ datos: await this.service.bajoStock() });
    }

    async disponibilidadGlobal(req, res) {
        const productoId = Validator.integer(req.query.productoId, 'producto', { required: true });
        res.json({ datos: await this.service.disponibilidadGlobal(productoId) });
    }

    async ajustar(req, res) {
        const productoId = Validator.integer(req.body.productoId, 'producto', { required: true });
        const sucursalId = Validator.integer(req.body.sucursalId, 'sucursal', { required: true });
        const cantidadAjuste = Validator.integer(req.body.cantidadAjuste, 'cantidad', { required: true });
        const motivo = Validator.text(req.body.motivo, 'motivo', { required: true, max: 300 });

        if (cantidadAjuste === 0) {
            throw new AppError(400, 'El ajuste debe ser diferente de cero.');
        }

        this.authGuard.exigirSucursal(req, sucursalId);

        await this.service.registrarAjuste({
            productoId,
            sucursalId,
            cantidadAjuste,
            usuarioId: req.user.sub,
            motivo
        });

        res.status(201).json({ mensaje: 'Ajuste de inventario registrado.' });
    }

    async listarAlertas(req, res) {
        const estado = Validator.text(req.query.estado, 'estado', { max: 10 }).toUpperCase();
        res.json({ datos: await this.service.listarAlertas({ estado }) });
    }

    async atenderAlerta(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        const alerta = await this.service.obtenerAlertaActiva(id);
        this.authGuard.exigirSucursal(req, alerta.SucursalID, 'sucursal de la alerta');
        await this.service.atenderAlerta(id);
        res.json({ mensaje: 'Alerta marcada como atendida.' });
    }
}

module.exports = { InventarioController };
