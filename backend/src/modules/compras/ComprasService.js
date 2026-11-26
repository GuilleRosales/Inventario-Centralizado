const { BaseService } = require('../../core/BaseService');
const { Validator } = require('../../core/Validator');
const { AppError } = require('../../core/AppError');
const { sql } = require('../../core/Database');

/**
 * Registro y consulta de compras a proveedores.
 */
class ComprasService extends BaseService {
    async listar({ desde = null, hasta = null, sucursalId = null, proveedorId = null, estado = '' } = {}) {
        const result = await this.query(
            `SELECT c.CompraID, c.NumeroFactura, c.FechaCompra, c.FechaRecepcion,
                    c.Estado, c.TotalCompra, c.Observaciones,
                    pr.ProveedorID, pr.NombreEmpresa AS Proveedor,
                    s.SucursalID, s.Nombre AS Sucursal,
                    u.Nombre AS UsuarioRegistro,
                    (SELECT COUNT(*) FROM dbo.CompraDetalle d WHERE d.CompraID = c.CompraID) AS Lineas
               FROM dbo.Compra c
               JOIN dbo.Proveedor pr ON pr.ProveedorID = c.ProveedorID
               JOIN dbo.Sucursal s ON s.SucursalID = c.SucursalDestinoID
               JOIN dbo.Usuario u ON u.UsuarioID = c.UsuarioRegistroID
              WHERE (@desde IS NULL OR c.FechaCompra >= @desde)
                AND (@hasta IS NULL OR c.FechaCompra < DATEADD(DAY, 1, @hasta))
                AND (@sucursalId IS NULL OR c.SucursalDestinoID = @sucursalId)
                AND (@proveedorId IS NULL OR c.ProveedorID = @proveedorId)
                AND (@estado = '' OR c.Estado = @estado)
              ORDER BY c.FechaCompra DESC, c.CompraID DESC`,
            {
                desde: { type: sql.Date, value: desde },
                hasta: { type: sql.Date, value: hasta },
                sucursalId,
                proveedorId,
                estado
            }
        );
        return result.recordset;
    }

    async obtener(id) {
        const compra = await this.query(
            `SELECT c.CompraID, c.NumeroFactura, c.FechaCompra, c.FechaRecepcion,
                    c.Estado, c.TotalCompra, c.Observaciones,
                    pr.ProveedorID, pr.NombreEmpresa AS Proveedor,
                    s.SucursalID, s.Nombre AS Sucursal,
                    u.Nombre AS UsuarioRegistro,
                    ur.Nombre AS UsuarioRecepcion
               FROM dbo.Compra c
               JOIN dbo.Proveedor pr ON pr.ProveedorID = c.ProveedorID
               JOIN dbo.Sucursal s ON s.SucursalID = c.SucursalDestinoID
               JOIN dbo.Usuario u ON u.UsuarioID = c.UsuarioRegistroID
               LEFT JOIN dbo.Usuario ur ON ur.UsuarioID = c.UsuarioRecepcionID
              WHERE c.CompraID = @id`,
            { id }
        );
        if (!compra.recordset[0]) throw new AppError(404, 'La compra no existe.');

        const detalle = await this.query(
            `SELECT d.CompraDetalleID, d.ProductoID, p.Codigo, p.Nombre AS Producto,
                    d.Cantidad, d.CostoUnitario, d.Subtotal
               FROM dbo.CompraDetalle d
               JOIN dbo.Producto p ON p.ProductoID = d.ProductoID
              WHERE d.CompraID = @id
              ORDER BY d.CompraDetalleID`,
            { id }
        );

        return { dato: compra.recordset[0], detalle: detalle.recordset };
    }

    /** Valida y normaliza la cabecera y las líneas de una compra. */
    preparar(body) {
        const proveedorId = Validator.integer(body.proveedorId, 'proveedor', { required: true });
        const sucursalDestinoId = Validator.integer(
            body.sucursalDestinoId,
            'sucursal destino',
            { required: true }
        );
        const numeroFactura = Validator.text(
            body.numeroFactura,
            'número de factura',
            { required: true, max: 60 }
        );
        const observaciones = Validator.text(body.observaciones, 'observaciones', { max: 300 }) || null;

        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) {
            throw new AppError(400, 'La compra debe contener al menos un producto.');
        }

        const normalizados = items.map((item, index) => ({
            productoId: Validator.integer(item.productoId, `producto de la línea ${index + 1}`, { required: true }),
            cantidad: Validator.integer(item.cantidad, `cantidad de la línea ${index + 1}`, { required: true, min: 1 }),
            costoUnitario: Validator.decimal(item.costoUnitario, `costo de la línea ${index + 1}`, { required: true })
        }));

        const productos = new Set(normalizados.map((item) => item.productoId));
        if (productos.size !== normalizados.length) {
            throw new AppError(400, 'No se puede repetir el mismo producto en una compra.');
        }

        const total = Number(normalizados
            .reduce((sum, item) => sum + item.cantidad * item.costoUnitario, 0)
            .toFixed(2));

        return {
            proveedorId,
            sucursalDestinoId,
            numeroFactura,
            observaciones,
            items: normalizados,
            total
        };
    }

    async crear(compra, usuarioId) {
        const compraId = await this.transaction(async (tx) => {
            const cabecera = await this.queryTx(
                tx,
                `INSERT INTO dbo.Compra
                     (ProveedorID, SucursalDestinoID, UsuarioRegistroID,
                      NumeroFactura, TotalCompra, Observaciones)
                 OUTPUT INSERTED.CompraID
                 VALUES (@proveedorId, @sucursalDestinoId, @usuarioId,
                         @numeroFactura, @total, @observaciones)`,
                {
                    proveedorId: { type: sql.Int, value: compra.proveedorId },
                    sucursalDestinoId: { type: sql.Int, value: compra.sucursalDestinoId },
                    usuarioId: { type: sql.Int, value: usuarioId },
                    numeroFactura: { type: sql.NVarChar(60), value: compra.numeroFactura },
                    total: { type: sql.Decimal(18, 2), value: compra.total },
                    observaciones: { type: sql.NVarChar(300), value: compra.observaciones }
                }
            );

            const nuevoId = cabecera.recordset[0].CompraID;

            for (const item of compra.items) {
                await this.queryTx(
                    tx,
                    `INSERT INTO dbo.CompraDetalle
                         (CompraID, ProductoID, Cantidad, CostoUnitario)
                     VALUES (@compraId, @productoId, @cantidad, @costoUnitario)`,
                    {
                        compraId: { type: sql.Int, value: nuevoId },
                        productoId: { type: sql.Int, value: item.productoId },
                        cantidad: { type: sql.Int, value: item.cantidad },
                        costoUnitario: { type: sql.Decimal(18, 2), value: item.costoUnitario }
                    }
                );
            }

            return nuevoId;
        });

        return { CompraID: compraId, TotalCompra: compra.total };
    }

    /** Sucursal destino de la compra; permite exigir que siga registrada. */
    async sucursalDeCompra(id, { soloRegistrada = false } = {}) {
        const result = await this.query(
            `SELECT SucursalDestinoID
               FROM dbo.Compra
              WHERE CompraID = @id
                AND (@soloRegistrada = 0 OR Estado = N'REGISTRADA')`,
            { id, soloRegistrada: soloRegistrada ? 1 : 0 }
        );
        if (!result.recordset[0]) {
            throw new AppError(
                404,
                soloRegistrada
                    ? 'La compra no existe o ya fue procesada.'
                    : 'La compra no existe.'
            );
        }
        return result.recordset[0].SucursalDestinoID;
    }

    async confirmar(id, usuarioId) {
        await this.query(
            'EXEC dbo.usp_ConfirmarCompra @CompraID = @id, @UsuarioID = @usuarioId',
            { id, usuarioId }
        );
    }

    async cancelar(id) {
        await this.query(
            `UPDATE dbo.Compra
                SET Estado = N'CANCELADA'
              WHERE CompraID = @id AND Estado = N'REGISTRADA'`,
            { id }
        );
    }
}

module.exports = { ComprasService };
