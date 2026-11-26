const { BaseController } = require('../../core/BaseController');

/**
 * Controlador HTTP del panel de control.
 */
class DashboardController extends BaseController {
    async resumen(req, res) {
        res.json(await this.service.obtenerResumen());
    }
}

module.exports = { DashboardController };
