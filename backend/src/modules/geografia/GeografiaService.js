const { BaseService } = require('../../core/BaseService');
const { Validator } = require('../../core/Validator');
const { AppError } = require('../../core/AppError');

/**
 * Lógica de países, divisiones territoriales, ciudades y sucursales.
 */
class GeografiaService extends BaseService {
    /* ------------------------------- PAÍSES ------------------------------- */
    async listarPaises({ incluirInactivos = false } = {}) {
        const result = await this.query(
            `SELECT PaisID, Nombre, CodigoISO2, Activo
               FROM dbo.Pais
              WHERE (@incluirInactivos = 1 OR Activo = 1)
              ORDER BY Nombre`,
            { incluirInactivos: incluirInactivos ? 1 : 0 }
        );
        return result.recordset;
    }

    async crearPais(datos) {
        const nombre = Validator.text(datos.nombre, 'nombre', { required: true, max: 100 });
        const codigoISO2 = Validator.text(datos.codigoISO2, 'código ISO', { max: 2 }).toUpperCase() || null;

        const result = await this.query(
            `INSERT INTO dbo.Pais (Nombre, CodigoISO2)
             OUTPUT INSERTED.PaisID, INSERTED.Nombre, INSERTED.CodigoISO2, INSERTED.Activo
             VALUES (@nombre, @codigoISO2)`,
            { nombre, codigoISO2 }
        );
        return result.recordset[0];
    }

    async actualizarPais(id, datos) {
        const nombre = Validator.text(datos.nombre, 'nombre', { required: true, max: 100 });
        const codigoISO2 = Validator.text(datos.codigoISO2, 'código ISO', { max: 2 }).toUpperCase() || null;
        const activo = Validator.boolean(datos.activo, true);

        const result = await this.query(
            `UPDATE dbo.Pais
                SET Nombre = @nombre, CodigoISO2 = @codigoISO2, Activo = @activo
              OUTPUT INSERTED.PaisID, INSERTED.Nombre, INSERTED.CodigoISO2, INSERTED.Activo
              WHERE PaisID = @id`,
            { id, nombre, codigoISO2, activo }
        );
        if (!result.recordset[0]) throw new AppError(404, 'El país no existe.');
        return result.recordset[0];
    }

    /* ----------------------------- DIVISIONES ----------------------------- */
    async listarDivisiones({ paisId = null, incluirInactivas = false } = {}) {
        const result = await this.query(
            `SELECT d.DivisionTerritorialID, d.PaisID, p.Nombre AS Pais,
                    d.TipoDivision, d.Nombre, d.Activa
               FROM dbo.DivisionTerritorial d
               JOIN dbo.Pais p ON p.PaisID = d.PaisID
              WHERE (@paisId IS NULL OR d.PaisID = @paisId)
                AND (@incluirInactivas = 1 OR d.Activa = 1)
              ORDER BY p.Nombre, d.TipoDivision, d.Nombre`,
            { paisId, incluirInactivas: incluirInactivas ? 1 : 0 }
        );
        return result.recordset;
    }

    async crearDivision(datos) {
        const paisId = Validator.integer(datos.paisId, 'país', { required: true });
        const tipoDivision = Validator.text(datos.tipoDivision, 'tipo de división', { required: true, max: 30 });
        const nombre = Validator.text(datos.nombre, 'nombre', { required: true, max: 100 });

        const result = await this.query(
            `INSERT INTO dbo.DivisionTerritorial (PaisID, TipoDivision, Nombre)
             OUTPUT INSERTED.DivisionTerritorialID, INSERTED.PaisID, INSERTED.TipoDivision,
                    INSERTED.Nombre, INSERTED.Activa
             VALUES (@paisId, @tipoDivision, @nombre)`,
            { paisId, tipoDivision, nombre }
        );
        return result.recordset[0];
    }

    async actualizarDivision(id, datos) {
        const paisId = Validator.integer(datos.paisId, 'país', { required: true });
        const tipoDivision = Validator.text(datos.tipoDivision, 'tipo de división', { required: true, max: 30 });
        const nombre = Validator.text(datos.nombre, 'nombre', { required: true, max: 100 });
        const activa = Validator.boolean(datos.activa, true);

        const result = await this.query(
            `UPDATE dbo.DivisionTerritorial
                SET PaisID = @paisId, TipoDivision = @tipoDivision,
                    Nombre = @nombre, Activa = @activa
              OUTPUT INSERTED.DivisionTerritorialID, INSERTED.PaisID, INSERTED.TipoDivision,
                     INSERTED.Nombre, INSERTED.Activa
              WHERE DivisionTerritorialID = @id`,
            { id, paisId, tipoDivision, nombre, activa }
        );
        if (!result.recordset[0]) throw new AppError(404, 'La división territorial no existe.');
        return result.recordset[0];
    }

    /* ------------------------------ CIUDADES ------------------------------ */
    async listarCiudades({ divisionId = null, paisId = null, incluirInactivas = false } = {}) {
        const result = await this.query(
            `SELECT c.CiudadID, c.DivisionTerritorialID, d.Nombre AS DivisionTerritorial,
                    d.PaisID, p.Nombre AS Pais, c.Nombre, c.Activa
               FROM dbo.Ciudad c
               JOIN dbo.DivisionTerritorial d ON d.DivisionTerritorialID = c.DivisionTerritorialID
               JOIN dbo.Pais p ON p.PaisID = d.PaisID
              WHERE (@divisionId IS NULL OR c.DivisionTerritorialID = @divisionId)
                AND (@paisId IS NULL OR d.PaisID = @paisId)
                AND (@incluirInactivas = 1 OR c.Activa = 1)
              ORDER BY p.Nombre, d.Nombre, c.Nombre`,
            { divisionId, paisId, incluirInactivas: incluirInactivas ? 1 : 0 }
        );
        return result.recordset;
    }

    async crearCiudad(datos) {
        const divisionId = Validator.integer(datos.divisionId, 'división territorial', { required: true });
        const nombre = Validator.text(datos.nombre, 'nombre', { required: true, max: 100 });

        const result = await this.query(
            `INSERT INTO dbo.Ciudad (DivisionTerritorialID, Nombre)
             OUTPUT INSERTED.CiudadID, INSERTED.DivisionTerritorialID, INSERTED.Nombre, INSERTED.Activa
             VALUES (@divisionId, @nombre)`,
            { divisionId, nombre }
        );
        return result.recordset[0];
    }

    async actualizarCiudad(id, datos) {
        const divisionId = Validator.integer(datos.divisionId, 'división territorial', { required: true });
        const nombre = Validator.text(datos.nombre, 'nombre', { required: true, max: 100 });
        const activa = Validator.boolean(datos.activa, true);

        const result = await this.query(
            `UPDATE dbo.Ciudad
                SET DivisionTerritorialID = @divisionId, Nombre = @nombre, Activa = @activa
              OUTPUT INSERTED.CiudadID, INSERTED.DivisionTerritorialID, INSERTED.Nombre, INSERTED.Activa
              WHERE CiudadID = @id`,
            { id, divisionId, nombre, activa }
        );
        if (!result.recordset[0]) throw new AppError(404, 'La ciudad no existe.');
        return result.recordset[0];
    }

    /* ----------------------------- SUCURSALES ----------------------------- */
    async listarSucursales({ ciudadId = null, paisId = null, incluirInactivas = false } = {}) {
        const result = await this.query(
            `SELECT s.SucursalID, s.CodigoSucursal, s.Nombre, s.Direccion, s.Telefono,
                    s.Activa, s.FechaCreacion,
                    c.CiudadID, c.Nombre AS Ciudad,
                    d.DivisionTerritorialID, d.Nombre AS DivisionTerritorial, d.TipoDivision,
                    p.PaisID, p.Nombre AS Pais
               FROM dbo.Sucursal s
               JOIN dbo.Ciudad c ON c.CiudadID = s.CiudadID
               JOIN dbo.DivisionTerritorial d ON d.DivisionTerritorialID = c.DivisionTerritorialID
               JOIN dbo.Pais p ON p.PaisID = d.PaisID
              WHERE (@ciudadId IS NULL OR s.CiudadID = @ciudadId)
                AND (@paisId IS NULL OR p.PaisID = @paisId)
                AND (@incluirInactivas = 1 OR s.Activa = 1)
              ORDER BY p.Nombre, d.Nombre, c.Nombre, s.Nombre`,
            { ciudadId, paisId, incluirInactivas: incluirInactivas ? 1 : 0 }
        );
        return result.recordset;
    }

    async crearSucursal(datos) {
        const ciudadId = Validator.integer(datos.ciudadId, 'ciudad', { required: true });
        const codigoSucursal = Validator.text(datos.codigoSucursal, 'código de sucursal', { required: true, max: 20 });
        const nombre = Validator.text(datos.nombre, 'nombre', { required: true, max: 120 });
        const direccion = Validator.text(datos.direccion, 'dirección', { required: true, max: 250 });
        const telefono = Validator.text(datos.telefono, 'teléfono', { max: 30 }) || null;

        const result = await this.query(
            `INSERT INTO dbo.Sucursal (CiudadID, CodigoSucursal, Nombre, Direccion, Telefono)
             OUTPUT INSERTED.SucursalID, INSERTED.CodigoSucursal, INSERTED.Nombre,
                    INSERTED.Direccion, INSERTED.Telefono, INSERTED.Activa
             VALUES (@ciudadId, @codigoSucursal, @nombre, @direccion, @telefono)`,
            { ciudadId, codigoSucursal, nombre, direccion, telefono }
        );
        return result.recordset[0];
    }

    async actualizarSucursal(id, datos) {
        const ciudadId = Validator.integer(datos.ciudadId, 'ciudad', { required: true });
        const codigoSucursal = Validator.text(datos.codigoSucursal, 'código de sucursal', { required: true, max: 20 });
        const nombre = Validator.text(datos.nombre, 'nombre', { required: true, max: 120 });
        const direccion = Validator.text(datos.direccion, 'dirección', { required: true, max: 250 });
        const telefono = Validator.text(datos.telefono, 'teléfono', { max: 30 }) || null;
        const activa = Validator.boolean(datos.activa, true);

        const result = await this.query(
            `UPDATE dbo.Sucursal
                SET CiudadID = @ciudadId, CodigoSucursal = @codigoSucursal,
                    Nombre = @nombre, Direccion = @direccion,
                    Telefono = @telefono, Activa = @activa
              OUTPUT INSERTED.SucursalID, INSERTED.CodigoSucursal, INSERTED.Nombre,
                     INSERTED.Direccion, INSERTED.Telefono, INSERTED.Activa
              WHERE SucursalID = @id`,
            { id, ciudadId, codigoSucursal, nombre, direccion, telefono, activa }
        );
        if (!result.recordset[0]) throw new AppError(404, 'La sucursal no existe.');
        return result.recordset[0];
    }
}

module.exports = { GeografiaService };
