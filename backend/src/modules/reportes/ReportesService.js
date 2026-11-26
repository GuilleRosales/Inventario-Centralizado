const { BaseService } = require('../../core/BaseService');
const { Validator } = require('../../core/Validator');
const { sql } = require('../../core/Database');

/**
 * Reportes analíticos de ventas, compras, transferencias e inventario valorado.
 */
class ReportesService extends BaseService {
    async ventas({ desde = null, hasta = null, sucursalId = null, categoria = '' } = {}) {
        const result = await this.query(
            `SELECT *
               FROM dbo.vw_ReporteVentas
              WHERE Estado = N'CONFIRMADA'
                AND (@desde IS NULL OR FechaVenta >= @desde)
                AND (@hasta IS NULL OR FechaVenta < DATEADD(DAY, 1, @hasta))
                AND (@sucursalId IS NULL OR SucursalID = @sucursalId)
                AND (@categoria = '' OR Categoria = @categoria)
              ORDER BY FechaVenta DESC, VentaID DESC`,
            {
                desde: { type: sql.Date, value: desde },
                hasta: { type: sql.Date, value: hasta },
                sucursalId,
                categoria
            }
        );
        return result.recordset;
    }

    async compras({ desde = null, hasta = null, sucursalId = null, categoria = '' } = {}) {
        const result = await this.query(
            `SELECT *
               FROM dbo.vw_ReporteCompras
              WHERE Estado = N'RECIBIDA'
                AND (@desde IS NULL OR FechaCompra >= @desde)
                AND (@hasta IS NULL OR FechaCompra < DATEADD(DAY, 1, @hasta))
                AND (@sucursalId IS NULL OR SucursalID = @sucursalId)
                AND (@categoria = '' OR Categoria = @categoria)
              ORDER BY FechaCompra DESC, CompraID DESC`,
            {
                desde: { type: sql.Date, value: desde },
                hasta: { type: sql.Date, value: hasta },
                sucursalId,
                categoria
            }
        );
        return result.recordset;
    }

    async transferencias({ desde = null, hasta = null, sucursalId = null } = {}) {
        const result = await this.query(
            `SELECT t.TransferenciaID, t.CodigoReferencia, t.FechaSolicitud,
                    t.FechaConfirmacion, t.Estado,
                    so.Nombre AS SucursalOrigen, sd.Nombre AS SucursalDestino,
                    p.ProductoID, p.Codigo AS CodigoProducto, p.Nombre AS Producto,
                    d.Cantidad, us.Nombre AS UsuarioSolicitante,
                    uc.Nombre AS UsuarioConfirmador
               FROM dbo.Transferencia t
               JOIN dbo.Sucursal so ON so.SucursalID = t.SucursalOrigenID
               JOIN dbo.Sucursal sd ON sd.SucursalID = t.SucursalDestinoID
               JOIN dbo.TransferenciaDetalle d ON d.TransferenciaID = t.TransferenciaID
               JOIN dbo.Producto p ON p.ProductoID = d.ProductoID
               JOIN dbo.Usuario us ON us.UsuarioID = t.UsuarioSolicitaID
               LEFT JOIN dbo.Usuario uc ON uc.UsuarioID = t.UsuarioConfirmaID
              WHERE (@desde IS NULL OR t.FechaSolicitud >= @desde)
                AND (@hasta IS NULL OR t.FechaSolicitud < DATEADD(DAY, 1, @hasta))
                AND (@sucursalId IS NULL
                     OR t.SucursalOrigenID = @sucursalId
                     OR t.SucursalDestinoID = @sucursalId)
              ORDER BY t.FechaSolicitud DESC, t.TransferenciaID DESC`,
            {
                desde: { type: sql.Date, value: desde },
                hasta: { type: sql.Date, value: hasta },
                sucursalId
            }
        );
        return result.recordset;
    }

    async inventarioValorado({ sucursalId = null, categoria = '' } = {}) {
        const result = await this.query(
            `SELECT pa.Nombre AS Pais, s.Nombre AS Sucursal, c.Nombre AS Categoria,
                    p.Codigo AS CodigoProducto, p.Nombre AS Producto,
                    i.Cantidad, p.PrecioVenta,
                    CONVERT(DECIMAL(18, 2), i.Cantidad * p.PrecioVenta) AS ValorInventario
               FROM dbo.InventarioSucursal i
               JOIN dbo.Producto p ON p.ProductoID = i.ProductoID
               JOIN dbo.Categoria c ON c.CategoriaID = p.CategoriaID
               JOIN dbo.Sucursal s ON s.SucursalID = i.SucursalID
               JOIN dbo.Ciudad ci ON ci.CiudadID = s.CiudadID
               JOIN dbo.DivisionTerritorial dt ON dt.DivisionTerritorialID = ci.DivisionTerritorialID
               JOIN dbo.Pais pa ON pa.PaisID = dt.PaisID
              WHERE (@sucursalId IS NULL OR i.SucursalID = @sucursalId)
                AND (@categoria = '' OR c.Nombre = @categoria)
              ORDER BY pa.Nombre, s.Nombre, c.Nombre, p.Nombre`,
            { sucursalId, categoria }
        );
        return result.recordset;
    }
}

module.exports = { ReportesService };
