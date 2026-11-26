const { BaseService } = require('../../core/BaseService');
const { AppError } = require('../../core/AppError');

/**
 * Consultas de existencias, ajustes y alertas de inventario.
 */
class InventarioService extends BaseService {
    async listar({ sucursalId = null, pais = '', buscar = '', soloBajoStock = false } = {}) {
        const result = await this.query(
            `SELECT v.*
               FROM dbo.vw_InventarioPorSucursal v
              WHERE (@sucursalId IS NULL OR v.SucursalID = @sucursalId)
                AND (@pais = '' OR v.Pais = @pais)
                AND (@soloBajoStock = 0 OR v.TieneStockBajo = 1)
                AND (@buscar = '' OR v.Producto LIKE '%' + @buscar + '%'
                     OR v.CodigoProducto LIKE '%' + @buscar + '%')
              ORDER BY v.Pais, v.Sucursal, v.Producto`,
            { sucursalId, pais, buscar, soloBajoStock: soloBajoStock ? 1 : 0 }
        );
        return result.recordset;
    }

    async bajoStock() {
        const result = await this.query(
            `SELECT * FROM dbo.vw_ProductosBajoStock
              ORDER BY Pais, Sucursal, Producto`
        );
        return result.recordset;
    }

    async disponibilidadGlobal(productoId) {
        const result = await this.query(
            `SELECT * FROM dbo.vw_DisponibilidadGlobal
              WHERE ProductoID = @productoId
              ORDER BY Pais, DivisionTerritorial, Ciudad, Sucursal`,
            { productoId }
        );
        return result.recordset;
    }

    async registrarAjuste({ productoId, sucursalId, cantidadAjuste, usuarioId, motivo }) {
        await this.query(
            `EXEC dbo.usp_RegistrarAjusteInventario
                 @ProductoID = @productoId,
                 @SucursalID = @sucursalId,
                 @CantidadAjuste = @cantidadAjuste,
                 @UsuarioID = @usuarioId,
                 @Motivo = @motivo`,
            { productoId, sucursalId, cantidadAjuste, usuarioId, motivo }
        );
    }

    async listarAlertas({ estado = '' } = {}) {
        const result = await this.query(
            `SELECT a.AlertaID, a.ProductoID, p.Codigo AS CodigoProducto, p.Nombre AS Producto,
                    a.SucursalID, s.CodigoSucursal, s.Nombre AS Sucursal,
                    pa.Nombre AS Pais, ci.Nombre AS Ciudad,
                    a.CantidadAlGenerarse, a.StockMinimoAlGenerarse,
                    a.FechaGeneracion, a.FechaAtencion, a.Estado
               FROM dbo.AlertaInventario a
               JOIN dbo.Producto p ON p.ProductoID = a.ProductoID
               JOIN dbo.Sucursal s ON s.SucursalID = a.SucursalID
               JOIN dbo.Ciudad ci ON ci.CiudadID = s.CiudadID
               JOIN dbo.DivisionTerritorial dt ON dt.DivisionTerritorialID = ci.DivisionTerritorialID
               JOIN dbo.Pais pa ON pa.PaisID = dt.PaisID
              WHERE (@estado = '' OR a.Estado = @estado)
              ORDER BY CASE WHEN a.Estado = 'ACTIVA' THEN 0 ELSE 1 END,
                       a.FechaGeneracion DESC`,
            { estado }
        );
        return result.recordset;
    }

    async obtenerAlertaActiva(id) {
        const result = await this.query(
            `SELECT AlertaID, SucursalID
               FROM dbo.AlertaInventario
              WHERE AlertaID = @id AND Estado = N'ACTIVA'`,
            { id }
        );
        if (!result.recordset[0]) {
            throw new AppError(404, 'La alerta no existe o ya fue atendida.');
        }
        return result.recordset[0];
    }

    async atenderAlerta(id) {
        await this.query(
            `UPDATE dbo.AlertaInventario
                SET Estado = N'ATENDIDA', FechaAtencion = SYSUTCDATETIME()
              WHERE AlertaID = @id AND Estado = N'ACTIVA'`,
            { id }
        );
    }
}

module.exports = { InventarioService };
