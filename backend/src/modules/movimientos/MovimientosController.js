const { BaseController } = require('../../core/BaseController');
const { Validator } = require('../../core/Validator');

/**
 * Controlador HTTP del historial de movimientos.
 */
class MovimientosController extends BaseController {
    async listar(req, res) {
        const limite = Math.min(
            Validator.integer(req.query.limite, 'límite', { min: 1 }) || 300,
            1000
        );

        const datos = await this.service.listar({
            productoId: Validator.integer(req.query.productoId, 'producto'),
            sucursalId: Validator.integer(req.query.sucursalId, 'sucursal'),
            tipo: Validator.text(req.query.tipo, 'tipo', { max: 30 }).toUpperCase(),
            desde: Validator.date(req.query.desde, 'desde'),
            hasta: Validator.date(req.query.hasta, 'hasta'),
            limite
        });
        res.json({ datos });
    }
}

module.exports = { MovimientosController };
