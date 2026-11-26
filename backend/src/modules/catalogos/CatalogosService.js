const { BaseService } = require('../../core/BaseService');
const { Validator } = require('../../core/Validator');
const { AppError } = require('../../core/AppError');

/**
 * Catálogos maestros: categorías, productos, clientes y proveedores.
 */
class CatalogosService extends BaseService {
    /* ------------------------------- CATEGORÍAS ------------------------------- */
    async listarCategorias({ incluirInactivas = false } = {}) {
        const result = await this.query(
            `SELECT c.CategoriaID, c.Nombre, c.Descripcion, c.Activa,
                    (SELECT COUNT(*) FROM dbo.Producto p WHERE p.CategoriaID = c.CategoriaID) AS Productos
               FROM dbo.Categoria c
              WHERE (@incluirInactivas = 1 OR c.Activa = 1)
              ORDER BY c.Nombre`,
            { incluirInactivas: incluirInactivas ? 1 : 0 }
        );
        return result.recordset;
    }

    async crearCategoria(datos) {
        const nombre = Validator.text(datos.nombre, 'nombre', { required: true, max: 100 });
        const descripcion = Validator.text(datos.descripcion, 'descripción', { max: 300 }) || null;

        const result = await this.query(
            `INSERT INTO dbo.Categoria (Nombre, Descripcion)
             OUTPUT INSERTED.CategoriaID, INSERTED.Nombre, INSERTED.Descripcion, INSERTED.Activa
             VALUES (@nombre, @descripcion)`,
            { nombre, descripcion }
        );
        return result.recordset[0];
    }

    async actualizarCategoria(id, datos) {
        const nombre = Validator.text(datos.nombre, 'nombre', { required: true, max: 100 });
        const descripcion = Validator.text(datos.descripcion, 'descripción', { max: 300 }) || null;
        const activa = Validator.boolean(datos.activa, true);

        const result = await this.query(
            `UPDATE dbo.Categoria
                SET Nombre = @nombre, Descripcion = @descripcion, Activa = @activa
              OUTPUT INSERTED.CategoriaID, INSERTED.Nombre, INSERTED.Descripcion, INSERTED.Activa
              WHERE CategoriaID = @id`,
            { id, nombre, descripcion, activa }
        );
        if (!result.recordset[0]) throw new AppError(404, 'La categoría no existe.');
        return result.recordset[0];
    }

    /* --------------------------------- PRODUCTOS ------------------------------- */
    async listarProductos({ buscar = '', categoriaId = null, incluirInactivos = false } = {}) {
        const result = await this.query(
            `SELECT p.ProductoID, p.CategoriaID, c.Nombre AS Categoria,
                    p.Codigo, p.Nombre, p.Descripcion, p.Marca, p.Modelo,
                    p.PrecioVenta, p.StockMinimo, p.StockMaximo, p.Activo, p.FechaCreacion,
                    COALESCE((SELECT SUM(i.Cantidad) FROM dbo.InventarioSucursal i
                               WHERE i.ProductoID = p.ProductoID), 0) AS ExistenciasTotales
               FROM dbo.Producto p
               JOIN dbo.Categoria c ON c.CategoriaID = p.CategoriaID
              WHERE (@categoriaId IS NULL OR p.CategoriaID = @categoriaId)
                AND (@incluirInactivos = 1 OR p.Activo = 1)
                AND (@buscar = '' OR p.Nombre LIKE '%' + @buscar + '%'
                     OR p.Codigo LIKE '%' + @buscar + '%'
                     OR p.Marca LIKE '%' + @buscar + '%')
              ORDER BY p.Nombre`,
            { buscar, categoriaId, incluirInactivos: incluirInactivos ? 1 : 0 }
        );
        return result.recordset;
    }

    #normalizarProducto(body, { partial = false } = {}) {
        const data = {
            categoriaId: Validator.integer(body.categoriaId, 'categoría', { required: !partial }),
            codigo: Validator.text(body.codigo, 'código', { required: !partial, max: 40 }),
            nombre: Validator.text(body.nombre, 'nombre', { required: !partial, max: 150 }),
            descripcion: Validator.text(body.descripcion, 'descripción', { max: 500 }) || null,
            marca: Validator.text(body.marca, 'marca', { max: 100 }) || null,
            modelo: Validator.text(body.modelo, 'modelo', { max: 100 }) || null,
            precioVenta: Validator.decimal(body.precioVenta, 'precio de venta', { required: !partial }),
            stockMinimo: Validator.integer(body.stockMinimo, 'stock mínimo', { min: 0 }) ?? 0,
            stockMaximo: Validator.integer(body.stockMaximo, 'stock máximo', { min: 0 })
        };
        if (data.stockMaximo !== null && data.stockMaximo < data.stockMinimo) {
            throw new AppError(400, 'El stock máximo no puede ser menor que el stock mínimo.');
        }
        return data;
    }

    async crearProducto(body) {
        const p = this.#normalizarProducto(body);
        const result = await this.query(
            `INSERT INTO dbo.Producto
                 (CategoriaID, Codigo, Nombre, Descripcion, Marca, Modelo,
                  PrecioVenta, StockMinimo, StockMaximo)
             OUTPUT INSERTED.ProductoID
             VALUES (@categoriaId, @codigo, @nombre, @descripcion, @marca, @modelo,
                     @precioVenta, @stockMinimo, @stockMaximo)`,
            p
        );
        return { ProductoID: result.recordset[0].ProductoID };
    }

    async actualizarProducto(id, body) {
        const p = this.#normalizarProducto(body);
        const activo = Validator.boolean(body.activo, true);

        const result = await this.query(
            `UPDATE dbo.Producto
                SET CategoriaID = @categoriaId, Codigo = @codigo, Nombre = @nombre,
                    Descripcion = @descripcion, Marca = @marca, Modelo = @modelo,
                    PrecioVenta = @precioVenta, StockMinimo = @stockMinimo,
                    StockMaximo = @stockMaximo, Activo = @activo
              OUTPUT INSERTED.ProductoID
              WHERE ProductoID = @id`,
            { ...p, id, activo }
        );
        if (!result.recordset[0]) throw new AppError(404, 'El producto no existe.');
        return result.recordset[0];
    }

    /* --------------------------------- CLIENTES -------------------------------- */
    async listarClientes({ buscar = '' } = {}) {
        const result = await this.query(
            `SELECT ClienteID, Nombre, NumeroDocumento, Telefono, Correo, Activo
               FROM dbo.Cliente
              WHERE Activo = 1
                AND (@buscar = '' OR Nombre LIKE '%' + @buscar + '%'
                     OR NumeroDocumento LIKE '%' + @buscar + '%')
              ORDER BY Nombre`,
            { buscar }
        );
        return result.recordset;
    }

    #normalizarCliente(body) {
        return {
            nombre: Validator.text(body.nombre, 'nombre', { required: true, max: 150 }),
            numeroDocumento: Validator.text(body.numeroDocumento, 'documento', { max: 40 }) || null,
            telefono: Validator.text(body.telefono, 'teléfono', { max: 30 }) || null,
            correo: Validator.text(body.correo, 'correo', { max: 150 }) || null
        };
    }

    async crearCliente(body) {
        const datos = this.#normalizarCliente(body);
        const result = await this.query(
            `INSERT INTO dbo.Cliente (Nombre, NumeroDocumento, Telefono, Correo)
             OUTPUT INSERTED.ClienteID, INSERTED.Nombre, INSERTED.NumeroDocumento,
                    INSERTED.Telefono, INSERTED.Correo, INSERTED.Activo
             VALUES (@nombre, @numeroDocumento, @telefono, @correo)`,
            datos
        );
        return result.recordset[0];
    }

    async actualizarCliente(id, body) {
        const datos = this.#normalizarCliente(body);
        const activo = Validator.boolean(body.activo, true);

        const result = await this.query(
            `UPDATE dbo.Cliente
                SET Nombre = @nombre, NumeroDocumento = @numeroDocumento,
                    Telefono = @telefono, Correo = @correo, Activo = @activo
              OUTPUT INSERTED.ClienteID, INSERTED.Nombre, INSERTED.NumeroDocumento,
                     INSERTED.Telefono, INSERTED.Correo, INSERTED.Activo
              WHERE ClienteID = @id`,
            { ...datos, id, activo }
        );
        if (!result.recordset[0]) throw new AppError(404, 'El cliente no existe.');
        return result.recordset[0];
    }

    /* -------------------------------- PROVEEDORES ------------------------------ */
    async listarProveedores({ buscar = '' } = {}) {
        const result = await this.query(
            `SELECT ProveedorID, NombreEmpresa, NumeroIdentificacion, Direccion,
                    Telefono, Correo, Activo
               FROM dbo.Proveedor
              WHERE Activo = 1
                AND (@buscar = '' OR NombreEmpresa LIKE '%' + @buscar + '%'
                     OR NumeroIdentificacion LIKE '%' + @buscar + '%')
              ORDER BY NombreEmpresa`,
            { buscar }
        );
        return result.recordset;
    }

    #normalizarProveedor(body) {
        return {
            nombreEmpresa: Validator.text(body.nombreEmpresa, 'nombre de la empresa', { required: true, max: 160 }),
            numeroIdentificacion: Validator.text(body.numeroIdentificacion, 'identificación', { max: 40 }) || null,
            direccion: Validator.text(body.direccion, 'dirección', { max: 250 }) || null,
            telefono: Validator.text(body.telefono, 'teléfono', { max: 30 }) || null,
            correo: Validator.text(body.correo, 'correo', { max: 150 }) || null
        };
    }

    async crearProveedor(body) {
        const datos = this.#normalizarProveedor(body);
        const result = await this.query(
            `INSERT INTO dbo.Proveedor
                 (NombreEmpresa, NumeroIdentificacion, Direccion, Telefono, Correo)
             OUTPUT INSERTED.ProveedorID, INSERTED.NombreEmpresa, INSERTED.NumeroIdentificacion,
                    INSERTED.Direccion, INSERTED.Telefono, INSERTED.Correo, INSERTED.Activo
             VALUES (@nombreEmpresa, @numeroIdentificacion, @direccion, @telefono, @correo)`,
            datos
        );
        return result.recordset[0];
    }

    async actualizarProveedor(id, body) {
        const datos = this.#normalizarProveedor(body);
        const activo = Validator.boolean(body.activo, true);

        const result = await this.query(
            `UPDATE dbo.Proveedor
                SET NombreEmpresa = @nombreEmpresa, NumeroIdentificacion = @numeroIdentificacion,
                    Direccion = @direccion, Telefono = @telefono, Correo = @correo, Activo = @activo
              OUTPUT INSERTED.ProveedorID, INSERTED.NombreEmpresa, INSERTED.NumeroIdentificacion,
                     INSERTED.Direccion, INSERTED.Telefono, INSERTED.Correo, INSERTED.Activo
              WHERE ProveedorID = @id`,
            { ...datos, id, activo }
        );
        if (!result.recordset[0]) throw new AppError(404, 'El proveedor no existe.');
        return result.recordset[0];
    }
}

module.exports = { CatalogosService };
