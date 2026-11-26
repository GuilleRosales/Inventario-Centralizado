const { BaseController } = require('../../core/BaseController');
const { Validator } = require('../../core/Validator');

/**
 * Controlador HTTP de países, divisiones, ciudades y sucursales.
 */
class GeografiaController extends BaseController {
    /* ------------------------------- PAÍSES ------------------------------- */
    async listarPaises(req, res) {
        const datos = await this.service.listarPaises({
            incluirInactivos: Validator.boolean(req.query.incluirInactivos, false)
        });
        res.json({ datos });
    }

    async crearPais(req, res) {
        res.status(201).json({ dato: await this.service.crearPais(req.body) });
    }

    async actualizarPais(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json({ dato: await this.service.actualizarPais(id, req.body) });
    }

    /* ----------------------------- DIVISIONES ----------------------------- */
    async listarDivisiones(req, res) {
        const datos = await this.service.listarDivisiones({
            paisId: Validator.integer(req.query.paisId, 'paisId'),
            incluirInactivas: Validator.boolean(req.query.incluirInactivas, false)
        });
        res.json({ datos });
    }

    async crearDivision(req, res) {
        res.status(201).json({ dato: await this.service.crearDivision(req.body) });
    }

    async actualizarDivision(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json({ dato: await this.service.actualizarDivision(id, req.body) });
    }

    /* ------------------------------ CIUDADES ------------------------------ */
    async listarCiudades(req, res) {
        const datos = await this.service.listarCiudades({
            divisionId: Validator.integer(req.query.divisionId, 'división'),
            paisId: Validator.integer(req.query.paisId, 'país'),
            incluirInactivas: Validator.boolean(req.query.incluirInactivas, false)
        });
        res.json({ datos });
    }

    async crearCiudad(req, res) {
        res.status(201).json({ dato: await this.service.crearCiudad(req.body) });
    }

    async actualizarCiudad(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json({ dato: await this.service.actualizarCiudad(id, req.body) });
    }

    /* ----------------------------- SUCURSALES ----------------------------- */
    async listarSucursales(req, res) {
        const datos = await this.service.listarSucursales({
            ciudadId: Validator.integer(req.query.ciudadId, 'ciudad'),
            paisId: Validator.integer(req.query.paisId, 'país'),
            incluirInactivas: Validator.boolean(req.query.incluirInactivas, false)
        });
        res.json({ datos });
    }

    async crearSucursal(req, res) {
        res.status(201).json({ dato: await this.service.crearSucursal(req.body) });
    }

    async actualizarSucursal(req, res) {
        const id = Validator.integer(req.params.id, 'id', { required: true });
        res.json({ dato: await this.service.actualizarSucursal(id, req.body) });
    }
}

module.exports = { GeografiaController };
