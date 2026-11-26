const { BaseService } = require('../../core/BaseService');
const { sql } = require('../../core/Database');

/**
 * Historial de movimientos de inventario (compras, ventas, transferencias y ajustes).
 */
class MovimientosService extends BaseService {
    async listar({
        productoId = null,
        sucursalId = null,
        tipo = '',
        desde = null,
        hasta = null,
        limite = 300
    } = {}) {
        const result = await this.query(
            `SELECT TOP (@limite)
                    MovimientoID, FechaHora, TipoMovimiento, ProductoID, CodigoProducto,
                    Producto, Cantidad, SucursalID, Sucursal, Pais, UsuarioID,
                    UsuarioResponsable, CompraID, VentaID, TransferenciaID, Observaciones
               FROM dbo.vw_HistorialMovimientos
              WHERE (@productoId IS NULL OR ProductoID = @productoId)
                AND (@sucursalId IS NULL OR SucursalID = @sucursalId)
                AND (@tipo = '' OR TipoMovimiento = @tipo)
                AND (@desde IS NULL OR FechaHora >= @desde)
                AND (@hasta IS NULL OR FechaHora < DATEADD(DAY, 1, @hasta))
              ORDER BY FechaHora DESC, MovimientoID DESC`,
            {
                productoId,
                sucursalId,
                tipo,
                desde: { type: sql.Date, value: desde },
                hasta: { type: sql.Date, value: hasta },
                limite
            }
        );
        return result.recordset;
    }
}

module.exports = { MovimientosService };
