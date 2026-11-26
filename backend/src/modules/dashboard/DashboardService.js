const { BaseService } = require('../../core/BaseService');

/**
 * Consultas agregadas del panel de control.
 */
class DashboardService extends BaseService {
    async obtenerResumen() {
        const [resumen, bajoStock, movimientos, porSucursal, ventasPorMes] = await Promise.all([
            this.query(
                `SELECT
                    (SELECT COUNT(*) FROM dbo.Producto WHERE Activo = 1) AS Productos,
                    (SELECT COUNT(*) FROM dbo.Sucursal WHERE Activa = 1) AS Sucursales,
                    (SELECT COUNT(*) FROM dbo.Usuario WHERE Activo = 1) AS Usuarios,
                    (SELECT COUNT(*) FROM dbo.AlertaInventario WHERE Estado = N'ACTIVA') AS AlertasActivas,
                    (SELECT COALESCE(SUM(Cantidad), 0) FROM dbo.InventarioSucursal) AS Existencias,
                    (SELECT COALESCE(SUM(TotalVenta), 0) FROM dbo.Venta
                      WHERE Estado = N'CONFIRMADA'
                        AND FechaConfirmacion >= DATEADD(MONTH, -1, SYSUTCDATETIME())) AS VentasMes,
                    (SELECT COALESCE(SUM(TotalCompra), 0) FROM dbo.Compra
                      WHERE Estado = N'RECIBIDA'
                        AND FechaRecepcion >= DATEADD(MONTH, -1, SYSUTCDATETIME())) AS ComprasMes`
            ),
            this.query(
                `SELECT TOP (6) Producto, CodigoProducto, Sucursal, Pais,
                        Cantidad, StockMinimoAplicado
                   FROM dbo.vw_ProductosBajoStock
                  ORDER BY Cantidad - StockMinimoAplicado, Producto`
            ),
            this.query(
                `SELECT TOP (8) MovimientoID, FechaHora, TipoMovimiento, Producto,
                        Cantidad, Sucursal, UsuarioResponsable
                   FROM dbo.vw_HistorialMovimientos
                  ORDER BY FechaHora DESC`
            ),
            this.query(
                `SELECT s.SucursalID, s.Nombre AS Sucursal, pa.Nombre AS Pais,
                        COALESCE(SUM(i.Cantidad), 0) AS Existencias
                   FROM dbo.Sucursal s
                   JOIN dbo.Ciudad c ON c.CiudadID = s.CiudadID
                   JOIN dbo.DivisionTerritorial d ON d.DivisionTerritorialID = c.DivisionTerritorialID
                   JOIN dbo.Pais pa ON pa.PaisID = d.PaisID
                   LEFT JOIN dbo.InventarioSucursal i ON i.SucursalID = s.SucursalID
                  WHERE s.Activa = 1
                  GROUP BY s.SucursalID, s.Nombre, pa.Nombre
                  ORDER BY Existencias DESC`
            ),
            this.query(
                `SELECT FORMAT(FechaConfirmacion, 'yyyy-MM') AS Periodo,
                        COALESCE(SUM(TotalVenta), 0) AS Total
                   FROM dbo.Venta
                  WHERE Estado = N'CONFIRMADA'
                    AND FechaConfirmacion >= DATEADD(
                        MONTH, -5,
                        DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1)
                    )
                  GROUP BY FORMAT(FechaConfirmacion, 'yyyy-MM')
                  ORDER BY Periodo`
            )
        ]);

        return {
            resumen: resumen.recordset[0],
            bajoStock: bajoStock.recordset,
            movimientos: movimientos.recordset,
            porSucursal: porSucursal.recordset,
            ventasPorMes: ventasPorMes.recordset
        };
    }
}

module.exports = { DashboardService };
