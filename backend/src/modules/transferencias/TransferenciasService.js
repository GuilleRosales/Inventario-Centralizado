const { BaseService } = require('../../core/BaseService');
const { Validator } = require('../../core/Validator');
const { AppError } = require('../../core/AppError');
const { sql } = require('../../core/Database');

/**
 * Solicitud, confirmación y consulta de transferencias entre sucursales.
 */
class TransferenciasService extends BaseService {
    async listar({ desde = null, hasta = null, origenId = null, destinoId = null, estado = '' } = {}) {
        const result = await this.query(
            `SELECT t.TransferenciaID, t.CodigoReferencia, t.FechaSolicitud, t.FechaConfirmacion,
                    t.Estado, t.Observaciones,
                    so.SucursalID AS SucursalOrigenID, so.Nombre AS SucursalOrigen,
                    sd.SucursalID AS SucursalDestinoID, sd.Nombre AS SucursalDestino,
                    us.Nombre AS UsuarioSolicita, uc.Nombre AS UsuarioConfirma,
                    (SELECT COUNT(*) FROM dbo.TransferenciaDetalle d
                      WHERE d.TransferenciaID = t.TransferenciaID) AS Lineas
               FROM dbo.Transferencia t
               JOIN dbo.Sucursal so ON so.SucursalID = t.SucursalOrigenID
               JOIN dbo.Sucursal sd ON sd.SucursalID = t.SucursalDestinoID
               JOIN dbo.Usuario us ON us.UsuarioID = t.UsuarioSolicitaID
               LEFT JOIN dbo.Usuario uc ON uc.UsuarioID = t.UsuarioConfirmaID
              WHERE (@desde IS NULL OR t.FechaSolicitud >= @desde)
                AND (@hasta IS NULL OR t.FechaSolicitud < DATEADD(DAY, 1, @hasta))
                AND (@origenId IS NULL OR t.SucursalOrigenID = @origenId)
                AND (@destinoId IS NULL OR t.SucursalDestinoID = @destinoId)
                AND (@estado = '' OR t.Estado = @estado)
              ORDER BY t.FechaSolicitud DESC, t.TransferenciaID DESC`,
            {
                desde: { type: sql.Date, value: desde },
                hasta: { type: sql.Date, value: hasta },
                origenId,
                destinoId,
                estado
            }
        );
        return result.recordset;
    }

    async obtener(id) {
        const transferencia = await this.query(
            `SELECT t.TransferenciaID, t.CodigoReferencia, t.FechaSolicitud, t.FechaConfirmacion,
                    t.Estado, t.Observaciones,
                    so.SucursalID AS SucursalOrigenID, so.Nombre AS SucursalOrigen,
                    sd.SucursalID AS SucursalDestinoID, sd.Nombre AS SucursalDestino,
                    us.Nombre AS UsuarioSolicita, uc.Nombre AS UsuarioConfirma
               FROM dbo.Transferencia t
               JOIN dbo.Sucursal so ON so.SucursalID = t.SucursalOrigenID
               JOIN dbo.Sucursal sd ON sd.SucursalID = t.SucursalDestinoID
               JOIN dbo.Usuario us ON us.UsuarioID = t.UsuarioSolicitaID
               LEFT JOIN dbo.Usuario uc ON uc.UsuarioID = t.UsuarioConfirmaID
              WHERE t.TransferenciaID = @id`,
            { id }
        );
        if (!transferencia.recordset[0]) throw new AppError(404, 'La transferencia no existe.');

        const detalle = await this.query(
            `SELECT d.TransferenciaDetalleID, d.ProductoID, p.Codigo, p.Nombre AS Producto,
                    d.Cantidad, COALESCE(i.Cantidad, 0) AS ExistenciaOrigen
               FROM dbo.TransferenciaDetalle d
               JOIN dbo.Transferencia t ON t.TransferenciaID = d.TransferenciaID
               JOIN dbo.Producto p ON p.ProductoID = d.ProductoID
               LEFT JOIN dbo.InventarioSucursal i
                      ON i.ProductoID = d.ProductoID AND i.SucursalID = t.SucursalOrigenID
              WHERE d.TransferenciaID = @id
              ORDER BY d.TransferenciaDetalleID`,
            { id }
        );

        return { dato: transferencia.recordset[0], detalle: detalle.recordset };
    }

    #generarCodigo() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
            + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const random = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `TRF-${stamp}-${random}`;
    }

    /** Valida y normaliza la cabecera y las líneas de una transferencia. */
    preparar(body) {
        const sucursalOrigenId = Validator.integer(
            body.sucursalOrigenId,
            'sucursal origen',
            { required: true }
        );
        const sucursalDestinoId = Validator.integer(
            body.sucursalDestinoId,
            'sucursal destino',
            { required: true }
        );
        const codigoReferencia = Validator.text(
            body.codigoReferencia,
            'código de referencia',
            { max: 60 }
        ) || this.#generarCodigo();
        const observaciones = Validator.text(body.observaciones, 'observaciones', { max: 300 }) || null;

        if (sucursalOrigenId === sucursalDestinoId) {
            throw new AppError(400, 'La sucursal de origen y destino deben ser diferentes.');
        }

        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) {
            throw new AppError(400, 'La transferencia debe contener al menos un producto.');
        }

        const normalizados = items.map((item, index) => ({
            productoId: Validator.integer(item.productoId, `producto de la línea ${index + 1}`, { required: true }),
            cantidad: Validator.integer(item.cantidad, `cantidad de la línea ${index + 1}`, { required: true, min: 1 })
        }));

        const productos = new Set(normalizados.map((item) => item.productoId));
        if (productos.size !== normalizados.length) {
            throw new AppError(400, 'No se puede repetir el mismo producto en una transferencia.');
        }

        return {
            sucursalOrigenId,
            sucursalDestinoId,
            codigoReferencia,
            observaciones,
            items: normalizados
        };
    }

    async crear(transferencia, usuarioId) {
        const transferenciaId = await this.transaction(async (tx) => {
            const cabecera = await this.queryTx(
                tx,
                `INSERT INTO dbo.Transferencia
                     (CodigoReferencia, SucursalOrigenID, SucursalDestinoID,
                      UsuarioSolicitaID, Observaciones)
                 OUTPUT INSERTED.TransferenciaID
                 VALUES (@codigo, @origenId, @destinoId, @usuarioId, @observaciones)`,
                {
                    codigo: { type: sql.NVarChar(60), value: transferencia.codigoReferencia },
                    origenId: { type: sql.Int, value: transferencia.sucursalOrigenId },
                    destinoId: { type: sql.Int, value: transferencia.sucursalDestinoId },
                    usuarioId: { type: sql.Int, value: usuarioId },
                    observaciones: { type: sql.NVarChar(300), value: transferencia.observaciones }
                }
            );

            const nuevoId = cabecera.recordset[0].TransferenciaID;

            for (const item of transferencia.items) {
                await this.queryTx(
                    tx,
                    `INSERT INTO dbo.TransferenciaDetalle
                         (TransferenciaID, ProductoID, Cantidad)
                     VALUES (@transferenciaId, @productoId, @cantidad)`,
                    {
                        transferenciaId: { type: sql.Int, value: nuevoId },
                        productoId: { type: sql.Int, value: item.productoId },
                        cantidad: { type: sql.Int, value: item.cantidad }
                    }
                );
            }

            return nuevoId;
        });

        return {
            TransferenciaID: transferenciaId,
            CodigoReferencia: transferencia.codigoReferencia
        };
    }

    /** Sucursales origen/destino; permite exigir que siga solicitada. */
    async sucursalesDeTransferencia(id, { soloSolicitada = false } = {}) {
        const result = await this.query(
            `SELECT SucursalOrigenID, SucursalDestinoID
               FROM dbo.Transferencia
              WHERE TransferenciaID = @id
                AND (@soloSolicitada = 0 OR Estado = N'SOLICITADA')`,
            { id, soloSolicitada: soloSolicitada ? 1 : 0 }
        );
        if (!result.recordset[0]) {
            throw new AppError(
                404,
                soloSolicitada
                    ? 'La transferencia no existe o ya fue procesada.'
                    : 'La transferencia no existe.'
            );
        }
        return [
            result.recordset[0].SucursalOrigenID,
            result.recordset[0].SucursalDestinoID
        ];
    }

    async confirmar(id, usuarioId) {
        await this.query(
            'EXEC dbo.usp_ConfirmarTransferencia @TransferenciaID = @id, @UsuarioID = @usuarioId',
            { id, usuarioId }
        );
    }

    async cancelar(id) {
        await this.query(
            `UPDATE dbo.Transferencia
                SET Estado = N'CANCELADA'
              WHERE TransferenciaID = @id AND Estado = N'SOLICITADA'`,
            { id }
        );
    }
}

module.exports = { TransferenciasService };
