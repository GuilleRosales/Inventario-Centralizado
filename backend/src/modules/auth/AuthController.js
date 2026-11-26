const { BaseController } = require('../../core/BaseController');

/**
 * Controlador HTTP del módulo de autenticación.
 */
class AuthController extends BaseController {
    async login(req, res) {
        const { correo, password } = req.body;
        const data = await this.service.login(correo, password);
        res.json(data);
    }

    async me(req, res) {
        res.json({ usuario: req.user });
    }
}

module.exports = { AuthController };
