const { BaseService } = require('../../core/BaseService');
const { Validator } = require('../../core/Validator');
const { AppError } = require('../../core/AppError');
const { sql } = require('../../core/Database');

/**
 * Registro, confirmación y consulta de ventas.
 */
class VentasService extends BaseService {
    async listar({ desde = null, hasta = null, sucursalId = null, clienteId = null, estado = '' } = {}) {
        const result = await this.query(
            `SELECT v.VentaID, v.NumeroComprobante, v.FechaVenta, v.FechaConfirmacion,
                    v.Estado, v.TotalVenta, v.Observaciones,
                    s.SucursalID, s.Nombre AS Sucursal,
                    c.ClienteID, c.Nombre AS Cliente,
                    u.Nombre AS UsuarioRegistro,
                    (SELECT COUNT(*) FROM dbo.VentaDetalle d WHERE d.VentaID = v.VentaID) AS Lineas
               FROM dbo.Venta v
               JOIN dbo.Sucursal s ON s.SucursalID = v.SucursalID
               LEFT JOIN dbo.Cliente c ON c.ClienteID = v.ClienteID
               JOIN dbo.Usuario u ON u.UsuarioID = v.UsuarioRegistroID
              WHERE (@desde IS NULL OR v.FechaVenta >= @desde)
                AND (@hasta IS NULL OR v.FechaVenta < DATEADD(DAY, 1, @hasta))
                AND (@sucursalId IS NULL OR v.SucursalID = @sucursalId)
                AND (@clienteId IS NULL OR v.ClienteID = @clienteId)
                AND (@estado = '' OR v.Estado = @estado)
              ORDER BY v.FechaVenta DESC, v.VentaID DESC`,
            {
                desde: { type: sql.Date, value: desde },
                hasta: { type: sql.Date, value: hasta },
                sucursalId,
                clienteId,
                estado
            }
        );
        return result.recordset;
    }

    async obtener(id) {
        const venta = await this.query(
            `SELECT v.VentaID, v.NumeroComprobante, v.FechaVenta, v.FechaConfirmacion,
                    v.Estado, v.TotalVenta, v.Observaciones,
                    s.SucursalID, s.Nombre AS Sucursal,
                    c.ClienteID, c.Nombre AS Cliente,
                    u.Nombre AS UsuarioRegistro,
                    uc.Nombre AS UsuarioConfirmacion
               FROM dbo.Venta v
               JOIN dbo.Sucursal s ON s.SucursalID = v.SucursalID
               LEFT JOIN dbo.Cliente c ON c.ClienteID = v.ClienteID
               JOIN dbo.Usuario u ON u.UsuarioID = v.UsuarioRegistroID
               LEFT JOIN dbo.Usuario uc ON uc.UsuarioID = v.UsuarioConfirmacionID
              WHERE v.VentaID = @id`,
            { id }
        );
        if (!venta.recordset[0]) throw new AppError(404, 'La venta no existe.');

        const detalle = await this.query(
            `SELECT d.VentaDetalleID, d.ProductoID, p.Codigo, p.Nombre AS Producto,
                    d.Cantidad, d.PrecioUnitario, d.Subtotal
               FROM dbo.VentaDetalle d
               JOIN dbo.Producto p ON p.ProductoID = d.ProductoID
              WHERE d.VentaID = @id
              ORDER BY d.VentaDetalleID`,
            { id }
        );

        return { dato: venta.recordset[0], detalle: detalle.recordset };
    }

    /** Valida y normaliza la cabecera y las líneas de una venta. */
    preparar(body) {
        const sucursalId = Validator.integer(body.sucursalId, 'sucursal', { required: true });
        const clienteId = Validator.integer(body.clienteId, 'cliente');
        const numeroComprobante = Validator.text(
            body.numeroComprobante,
            'número de comprobante',
            { required: true, max: 60 }
        );
        const observaciones = Validator.text(body.observaciones, 'observaciones', { max: 300 }) || null;

        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) {
            throw new AppError(400, 'La venta debe contener al menos un producto.');
        }

        const normalizados = items.map((item, index) => ({
            productoId: Validator.integer(item.productoId, `producto de la línea ${index + 1}`, { required: true }),
            cantidad: Validator.integer(item.cantidad, `cantidad de la línea ${index + 1}`, { required: true, min: 1 }),
            precioUnitario: Validator.decimal(item.precioUnitario, `precio de la línea ${index + 1}`, { required: true })
        }));

        const productos = new Set(normalizados.map((item) => item.productoId));
        if (productos.size !== normalizados.length) {
            throw new AppError(400, 'No se puede repetir el mismo producto en una venta.');
        }

        const total = Number(normalizados
            .reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0)
            .toFixed(2));

        return {
            sucursalId,
            clienteId,
            numeroComprobante,
            observaciones,
            items: normalizados,
            total
        };
    }

    async crear(venta, usuarioId) {
        const ventaId = await this.transaction(async (tx) => {
            const cabecera = await this.queryTx(
                tx,
                `INSERT INTO dbo.Venta
                     (SucursalID, ClienteID, UsuarioRegistroID,
                      NumeroComprobante, TotalVenta, Observaciones)
                 OUTPUT INSERTED.VentaID
                 VALUES (@sucursalId, @clienteId, @usuarioId,
                         @numeroComprobante, @total, @observaciones)`,
                {
                    sucursalId: { type: sql.Int, value: venta.sucursalId },
                    clienteId: { type: sql.Int, value: venta.clienteId },
                    usuarioId: { type: sql.Int, value: usuarioId },
                    numeroComprobante: { type: sql.NVarChar(60), value: venta.numeroComprobante },
                    total: { type: sql.Decimal(18, 2), value: venta.total },
                    observaciones: { type: sql.NVarChar(300), value: venta.observaciones }
                }
            );

            const nuevoId = cabecera.recordset[0].VentaID;

            for (const item of venta.items) {
                await this.queryTx(
                    tx,
                    `INSERT INTO dbo.VentaDetalle
                         (VentaID, ProductoID, Cantidad, PrecioUnitario)
                     VALUES (@ventaId, @productoId, @cantidad, @precioUnitario)`,
                    {
                        ventaId: { type: sql.Int, value: nuevoId },
                        productoId: { type: sql.Int, value: item.productoId },
                        cantidad: { type: sql.Int, value: item.cantidad },
                        precioUnitario: { type: sql.Decimal(18, 2), value: item.precioUnitario }
                    }
                );
            }

            return nuevoId;
        });

        return { VentaID: ventaId, TotalVenta: venta.total };
    }

    /** Sucursal de la venta; permite exigir que siga registrada. */
    async sucursalDeVenta(id, { soloRegistrada = false } = {}) {
        const result = await this.query(
            `SELECT SucursalID
               FROM dbo.Venta
              WHERE VentaID = @id
                AND (@soloRegistrada = 0 OR Estado = N'REGISTRADA')`,
            { id, soloRegistrada: soloRegistrada ? 1 : 0 }
        );
        if (!result.recordset[0]) {
            throw new AppError(
                404,
                soloRegistrada
                    ? 'La venta no existe o ya fue procesada.'
                    : 'La venta no existe.'
            );
        }
        return result.recordset[0].SucursalID;
    }

    async confirmar(id, usuarioId) {
        await this.query(
            'EXEC dbo.usp_ConfirmarVenta @VentaID = @id, @UsuarioID = @usuarioId',
            { id, usuarioId }
        );
    }

    async cancelar(id) {
        await this.query(
            `UPDATE dbo.Venta
                SET Estado = N'CANCELADA'
              WHERE VentaID = @id AND Estado = N'REGISTRADA'`,
            { id }
        );
    }
}

module.exports = { VentasService };
