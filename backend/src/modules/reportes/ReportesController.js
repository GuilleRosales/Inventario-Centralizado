const { BaseController } = require('../../core/BaseController');
const { Validator } = require('../../core/Validator');

/**
 * Controlador HTTP de reportes.
 */
class ReportesController extends BaseController {
    #filtros(req) {
        return {
            desde: Validator.date(req.query.desde, 'desde'),
            hasta: Validator.date(req.query.hasta, 'hasta'),
            sucursalId: Validator.integer(req.query.sucursalId, 'sucursal'),
            categoria: Validator.text(req.query.categoria, 'categoría', { max: 100 })
        };
    }

    async ventas(req, res) {
        res.json({ datos: await this.service.ventas(this.#filtros(req)) });
    }

    async compras(req, res) {
        res.json({ datos: await this.service.compras(this.#filtros(req)) });
    }

    async transferencias(req, res) {
        const { desde, hasta, sucursalId } = this.#filtros(req);
        res.json({ datos: await this.service.transferencias({ desde, hasta, sucursalId }) });
    }

    async inventarioValorado(req, res) {
        const { sucursalId, categoria } = this.#filtros(req);
        res.json({ datos: await this.service.inventarioValorado({ sucursalId, categoria }) });
    }
}

module.exports = { ReportesController };
