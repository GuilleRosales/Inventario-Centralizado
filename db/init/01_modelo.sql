/*
    MODELO DE BASE DE DATOS - SISTEMA CENTRALIZADO DE INVENTARIO
    Motor: Microsoft SQL Server (T-SQL)

    Basado en los avances del proyecto:
      - Gestion geografica: Pais -> Division territorial -> Ciudad -> Sucursal.
      - Catalogo centralizado de categorias y productos.
      - Usuarios, roles, permisos y asignacion de sucursales.
      - Inventario por producto y sucursal.
      - Compras, ventas y transferencias con actualizacion transaccional.
      - Historial de movimientos y alertas de stock minimo.

    NOTAS DE DISENO:
      1. Las cantidades de MovimientoInventario siempre se guardan positivas.
         El tipo de movimiento determina si representa entrada o salida.
      2. Las existencias solo se modifican al confirmar/recibir la operacion
         mediante los procedimientos almacenados incluidos en este script.
      3. StockMinimo y StockMaximo en Producto son valores generales. La tabla
         InventarioSucursal permite sobreescribirlos por sucursal.
      4. PasswordHash almacena un hash seguro generado por la aplicacion.
         Nunca se debe almacenar la contrasena en texto plano.
*/

/* 1. CREACION Y SELECCION DE LA BASE DE DATOS */
IF DB_ID(N'InventarioCentralizado') IS NULL
BEGIN
    EXEC(N'CREATE DATABASE InventarioCentralizado');
END;
GO

USE InventarioCentralizado;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

/* 2. ESTRUCTURA GEOGRAFICA */
CREATE TABLE dbo.Pais
(
    PaisID          INT IDENTITY(1,1) NOT NULL,
    Nombre          NVARCHAR(100) NOT NULL,
    CodigoISO2      CHAR(2) NULL,
    Activo          BIT NOT NULL CONSTRAINT DF_Pais_Activo DEFAULT (1),
    CONSTRAINT PK_Pais PRIMARY KEY (PaisID),
    CONSTRAINT UQ_Pais_Nombre UNIQUE (Nombre)
);
GO

CREATE UNIQUE INDEX UX_Pais_CodigoISO2
    ON dbo.Pais(CodigoISO2)
    WHERE CodigoISO2 IS NOT NULL;
GO

CREATE TABLE dbo.DivisionTerritorial
(
    DivisionTerritorialID INT IDENTITY(1,1) NOT NULL,
    PaisID                INT NOT NULL,
    TipoDivision          NVARCHAR(30) NOT NULL,
    Nombre                NVARCHAR(100) NOT NULL,
    Activa                BIT NOT NULL CONSTRAINT DF_Division_Activa DEFAULT (1),
    CONSTRAINT PK_DivisionTerritorial PRIMARY KEY (DivisionTerritorialID),
    CONSTRAINT FK_Division_Pais FOREIGN KEY (PaisID)
        REFERENCES dbo.Pais(PaisID),
    CONSTRAINT UQ_Division_Pais_Nombre UNIQUE (PaisID, TipoDivision, Nombre)
);
GO

CREATE TABLE dbo.Ciudad
(
    CiudadID              INT IDENTITY(1,1) NOT NULL,
    DivisionTerritorialID INT NOT NULL,
    Nombre                NVARCHAR(100) NOT NULL,
    Activa                BIT NOT NULL CONSTRAINT DF_Ciudad_Activa DEFAULT (1),
    CONSTRAINT PK_Ciudad PRIMARY KEY (CiudadID),
    CONSTRAINT FK_Ciudad_Division FOREIGN KEY (DivisionTerritorialID)
        REFERENCES dbo.DivisionTerritorial(DivisionTerritorialID),
    CONSTRAINT UQ_Ciudad_Division_Nombre UNIQUE (DivisionTerritorialID, Nombre)
);
GO

CREATE TABLE dbo.Sucursal
(
    SucursalID       INT IDENTITY(1,1) NOT NULL,
    CiudadID         INT NOT NULL,
    CodigoSucursal   NVARCHAR(20) NOT NULL,
    Nombre           NVARCHAR(120) NOT NULL,
    Direccion        NVARCHAR(250) NOT NULL,
    Telefono         NVARCHAR(30) NULL,
    Activa           BIT NOT NULL CONSTRAINT DF_Sucursal_Activa DEFAULT (1),
    FechaCreacion    DATETIME2(0) NOT NULL CONSTRAINT DF_Sucursal_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Sucursal PRIMARY KEY (SucursalID),
    CONSTRAINT FK_Sucursal_Ciudad FOREIGN KEY (CiudadID)
        REFERENCES dbo.Ciudad(CiudadID),
    CONSTRAINT UQ_Sucursal_Codigo UNIQUE (CodigoSucursal)
);
GO

CREATE INDEX IX_Sucursal_Ciudad ON dbo.Sucursal(CiudadID);
GO

/* 3. CATALOGO DE PRODUCTOS */
CREATE TABLE dbo.Categoria
(
    CategoriaID   INT IDENTITY(1,1) NOT NULL,
    Nombre        NVARCHAR(100) NOT NULL,
    Descripcion   NVARCHAR(300) NULL,
    Activa        BIT NOT NULL CONSTRAINT DF_Categoria_Activa DEFAULT (1),
    CONSTRAINT PK_Categoria PRIMARY KEY (CategoriaID),
    CONSTRAINT UQ_Categoria_Nombre UNIQUE (Nombre)
);
GO

CREATE TABLE dbo.Producto
(
    ProductoID       INT IDENTITY(1,1) NOT NULL,
    CategoriaID      INT NOT NULL,
    Codigo           NVARCHAR(40) NOT NULL,
    Nombre           NVARCHAR(150) NOT NULL,
    Descripcion      NVARCHAR(500) NULL,
    Marca            NVARCHAR(100) NULL,
    Modelo           NVARCHAR(100) NULL,
    PrecioVenta      DECIMAL(18,2) NOT NULL,
    StockMinimo      INT NOT NULL CONSTRAINT DF_Producto_StockMinimo DEFAULT (0),
    StockMaximo      INT NULL,
    Activo           BIT NOT NULL CONSTRAINT DF_Producto_Activo DEFAULT (1),
    FechaCreacion    DATETIME2(0) NOT NULL CONSTRAINT DF_Producto_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Producto PRIMARY KEY (ProductoID),
    CONSTRAINT FK_Producto_Categoria FOREIGN KEY (CategoriaID)
        REFERENCES dbo.Categoria(CategoriaID),
    CONSTRAINT UQ_Producto_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_Producto_Precio CHECK (PrecioVenta >= 0),
    CONSTRAINT CK_Producto_StockMinimo CHECK (StockMinimo >= 0),
    CONSTRAINT CK_Producto_StockMaximo CHECK (StockMaximo IS NULL OR StockMaximo >= StockMinimo)
);
GO

CREATE INDEX IX_Producto_Categoria ON dbo.Producto(CategoriaID);
CREATE INDEX IX_Producto_Nombre ON dbo.Producto(Nombre);
GO

/* 4. CLIENTES Y PROVEEDORES */
CREATE TABLE dbo.Cliente
(
    ClienteID          INT IDENTITY(1,1) NOT NULL,
    Nombre             NVARCHAR(150) NOT NULL,
    NumeroDocumento    NVARCHAR(40) NULL,
    Telefono           NVARCHAR(30) NULL,
    Correo             NVARCHAR(150) NULL,
    Activo             BIT NOT NULL CONSTRAINT DF_Cliente_Activo DEFAULT (1),
    CONSTRAINT PK_Cliente PRIMARY KEY (ClienteID)
);
GO

CREATE TABLE dbo.Proveedor
(
    ProveedorID          INT IDENTITY(1,1) NOT NULL,
    NombreEmpresa        NVARCHAR(160) NOT NULL,
    NumeroIdentificacion NVARCHAR(40) NULL,
    Direccion            NVARCHAR(250) NULL,
    Telefono             NVARCHAR(30) NULL,
    Correo               NVARCHAR(150) NULL,
    Activo               BIT NOT NULL CONSTRAINT DF_Proveedor_Activo DEFAULT (1),
    CONSTRAINT PK_Proveedor PRIMARY KEY (ProveedorID)
);
GO

/* 5. USUARIOS, ROLES Y PERMISOS */
CREATE TABLE dbo.Usuario
(
    UsuarioID       INT IDENTITY(1,1) NOT NULL,
    Nombre          NVARCHAR(150) NOT NULL,
    Correo          NVARCHAR(150) NOT NULL,
    PasswordHash    NVARCHAR(255) NOT NULL,
    Activo          BIT NOT NULL CONSTRAINT DF_Usuario_Activo DEFAULT (1),
    FechaCreacion   DATETIME2(0) NOT NULL CONSTRAINT DF_Usuario_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Usuario PRIMARY KEY (UsuarioID),
    CONSTRAINT UQ_Usuario_Correo UNIQUE (Correo)
);
GO

CREATE TABLE dbo.Rol
(
    RolID          INT IDENTITY(1,1) NOT NULL,
    Nombre         NVARCHAR(80) NOT NULL,
    Descripcion    NVARCHAR(250) NULL,
    Activo         BIT NOT NULL CONSTRAINT DF_Rol_Activo DEFAULT (1),
    CONSTRAINT PK_Rol PRIMARY KEY (RolID),
    CONSTRAINT UQ_Rol_Nombre UNIQUE (Nombre)
);
GO

CREATE TABLE dbo.Permiso
(
    PermisoID      INT IDENTITY(1,1) NOT NULL,
    Codigo         NVARCHAR(100) NOT NULL,
    Descripcion    NVARCHAR(250) NULL,
    CONSTRAINT PK_Permiso PRIMARY KEY (PermisoID),
    CONSTRAINT UQ_Permiso_Codigo UNIQUE (Codigo)
);
GO

/* Un usuario puede tener uno o varios roles. */
CREATE TABLE dbo.UsuarioRol
(
    UsuarioID             INT NOT NULL,
    RolID                 INT NOT NULL,
    FechaAsignacion       DATETIME2(0) NOT NULL CONSTRAINT DF_UsuarioRol_Fecha DEFAULT (SYSUTCDATETIME()),
    AsignadoPorUsuarioID  INT NULL,
    CONSTRAINT PK_UsuarioRol PRIMARY KEY (UsuarioID, RolID),
    CONSTRAINT FK_UsuarioRol_Usuario FOREIGN KEY (UsuarioID)
        REFERENCES dbo.Usuario(UsuarioID),
    CONSTRAINT FK_UsuarioRol_Rol FOREIGN KEY (RolID)
        REFERENCES dbo.Rol(RolID),
    CONSTRAINT FK_UsuarioRol_AsignadoPor FOREIGN KEY (AsignadoPorUsuarioID)
        REFERENCES dbo.Usuario(UsuarioID)
);
GO

CREATE TABLE dbo.RolPermiso
(
    RolID       INT NOT NULL,
    PermisoID   INT NOT NULL,
    CONSTRAINT PK_RolPermiso PRIMARY KEY (RolID, PermisoID),
    CONSTRAINT FK_RolPermiso_Rol FOREIGN KEY (RolID)
        REFERENCES dbo.Rol(RolID),
    CONSTRAINT FK_RolPermiso_Permiso FOREIGN KEY (PermisoID)
        REFERENCES dbo.Permiso(PermisoID)
);
GO

/* Un usuario puede estar autorizado para operar en varias sucursales. */
CREATE TABLE dbo.UsuarioSucursal
(
    UsuarioID       INT NOT NULL,
    SucursalID      INT NOT NULL,
    EsPrincipal     BIT NOT NULL CONSTRAINT DF_UsuarioSucursal_Principal DEFAULT (0),
    CONSTRAINT PK_UsuarioSucursal PRIMARY KEY (UsuarioID, SucursalID),
    CONSTRAINT FK_UsuarioSucursal_Usuario FOREIGN KEY (UsuarioID)
        REFERENCES dbo.Usuario(UsuarioID),
    CONSTRAINT FK_UsuarioSucursal_Sucursal FOREIGN KEY (SucursalID)
        REFERENCES dbo.Sucursal(SucursalID)
);
GO

CREATE UNIQUE INDEX UX_UsuarioSucursal_Principal
    ON dbo.UsuarioSucursal(UsuarioID)
    WHERE EsPrincipal = 1;
GO

/* 6. EXISTENCIAS POR SUCURSAL */
CREATE TABLE dbo.InventarioSucursal
(
    ProductoID              INT NOT NULL,
    SucursalID              INT NOT NULL,
    Cantidad                INT NOT NULL CONSTRAINT DF_Inventario_Cantidad DEFAULT (0),
    StockMinimoOverride     INT NULL,
    StockMaximoOverride     INT NULL,
    FechaActualizacion      DATETIME2(0) NOT NULL CONSTRAINT DF_Inventario_Fecha DEFAULT (SYSUTCDATETIME()),
    Disponible AS (CONVERT(BIT, CASE WHEN Cantidad > 0 THEN 1 ELSE 0 END)) PERSISTED,
    CONSTRAINT PK_InventarioSucursal PRIMARY KEY (ProductoID, SucursalID),
    CONSTRAINT FK_Inventario_Producto FOREIGN KEY (ProductoID)
        REFERENCES dbo.Producto(ProductoID),
    CONSTRAINT FK_Inventario_Sucursal FOREIGN KEY (SucursalID)
        REFERENCES dbo.Sucursal(SucursalID),
    CONSTRAINT CK_Inventario_Cantidad CHECK (Cantidad >= 0),
    CONSTRAINT CK_Inventario_StockMinimo CHECK (StockMinimoOverride IS NULL OR StockMinimoOverride >= 0),
    CONSTRAINT CK_Inventario_StockMaximo CHECK
        (StockMaximoOverride IS NULL OR StockMinimoOverride IS NULL OR StockMaximoOverride >= StockMinimoOverride)
);
GO

CREATE INDEX IX_Inventario_Sucursal ON dbo.InventarioSucursal(SucursalID, ProductoID);
GO

/* 7. COMPRAS Y RECEPCIONES */
CREATE TABLE dbo.Compra
(
    CompraID              INT IDENTITY(1,1) NOT NULL,
    ProveedorID           INT NOT NULL,
    SucursalDestinoID     INT NOT NULL,
    UsuarioRegistroID     INT NOT NULL,
    UsuarioRecepcionID    INT NULL,
    NumeroFactura         NVARCHAR(60) NOT NULL,
    FechaCompra           DATETIME2(0) NOT NULL CONSTRAINT DF_Compra_Fecha DEFAULT (SYSUTCDATETIME()),
    FechaRecepcion        DATETIME2(0) NULL,
    Estado                NVARCHAR(15) NOT NULL CONSTRAINT DF_Compra_Estado DEFAULT (N'REGISTRADA'),
    TotalCompra           DECIMAL(18,2) NOT NULL CONSTRAINT DF_Compra_Total DEFAULT (0),
    Observaciones         NVARCHAR(300) NULL,
    CONSTRAINT PK_Compra PRIMARY KEY (CompraID),
    CONSTRAINT FK_Compra_Proveedor FOREIGN KEY (ProveedorID)
        REFERENCES dbo.Proveedor(ProveedorID),
    CONSTRAINT FK_Compra_Sucursal FOREIGN KEY (SucursalDestinoID)
        REFERENCES dbo.Sucursal(SucursalID),
    CONSTRAINT FK_Compra_UsuarioRegistro FOREIGN KEY (UsuarioRegistroID)
        REFERENCES dbo.Usuario(UsuarioID),
    CONSTRAINT FK_Compra_UsuarioRecepcion FOREIGN KEY (UsuarioRecepcionID)
        REFERENCES dbo.Usuario(UsuarioID),
    CONSTRAINT UQ_Compra_Proveedor_Factura UNIQUE (ProveedorID, NumeroFactura),
    CONSTRAINT CK_Compra_Estado CHECK (Estado IN (N'REGISTRADA', N'RECIBIDA', N'CANCELADA')),
    CONSTRAINT CK_Compra_Total CHECK (TotalCompra >= 0)
);
GO

CREATE TABLE dbo.CompraDetalle
(
    CompraDetalleID   INT IDENTITY(1,1) NOT NULL,
    CompraID          INT NOT NULL,
    ProductoID        INT NOT NULL,
    Cantidad          INT NOT NULL,
    CostoUnitario     DECIMAL(18,2) NOT NULL,
    Subtotal AS (CONVERT(DECIMAL(18,2), Cantidad * CostoUnitario)) PERSISTED,
    CONSTRAINT PK_CompraDetalle PRIMARY KEY (CompraDetalleID),
    CONSTRAINT FK_CompraDetalle_Compra FOREIGN KEY (CompraID)
        REFERENCES dbo.Compra(CompraID),
    CONSTRAINT FK_CompraDetalle_Producto FOREIGN KEY (ProductoID)
        REFERENCES dbo.Producto(ProductoID),
    CONSTRAINT UQ_CompraDetalle_Producto UNIQUE (CompraID, ProductoID),
    CONSTRAINT CK_CompraDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_CompraDetalle_Costo CHECK (CostoUnitario >= 0)
);
GO

CREATE INDEX IX_Compra_Sucursal_Fecha ON dbo.Compra(SucursalDestinoID, FechaCompra);
CREATE INDEX IX_CompraDetalle_Producto ON dbo.CompraDetalle(ProductoID);
GO

/* 8. VENTAS */
CREATE TABLE dbo.Venta
(
    VentaID                 INT IDENTITY(1,1) NOT NULL,
    SucursalID              INT NOT NULL,
    ClienteID               INT NULL,
    UsuarioRegistroID       INT NOT NULL,
    UsuarioConfirmacionID   INT NULL,
    NumeroComprobante       NVARCHAR(60) NOT NULL,
    FechaVenta              DATETIME2(0) NOT NULL CONSTRAINT DF_Venta_Fecha DEFAULT (SYSUTCDATETIME()),
    FechaConfirmacion       DATETIME2(0) NULL,
    Estado                  NVARCHAR(15) NOT NULL CONSTRAINT DF_Venta_Estado DEFAULT (N'REGISTRADA'),
    TotalVenta              DECIMAL(18,2) NOT NULL CONSTRAINT DF_Venta_Total DEFAULT (0),
    Observaciones           NVARCHAR(300) NULL,
    CONSTRAINT PK_Venta PRIMARY KEY (VentaID),
    CONSTRAINT FK_Venta_Sucursal FOREIGN KEY (SucursalID)
        REFERENCES dbo.Sucursal(SucursalID),
    CONSTRAINT FK_Venta_Cliente FOREIGN KEY (ClienteID)
        REFERENCES dbo.Cliente(ClienteID),
    CONSTRAINT FK_Venta_UsuarioRegistro FOREIGN KEY (UsuarioRegistroID)
        REFERENCES dbo.Usuario(UsuarioID),
    CONSTRAINT FK_Venta_UsuarioConfirmacion FOREIGN KEY (UsuarioConfirmacionID)
        REFERENCES dbo.Usuario(UsuarioID),
    CONSTRAINT UQ_Venta_Sucursal_Comprobante UNIQUE (SucursalID, NumeroComprobante),
    CONSTRAINT CK_Venta_Estado CHECK (Estado IN (N'REGISTRADA', N'CONFIRMADA', N'CANCELADA')),
    CONSTRAINT CK_Venta_Total CHECK (TotalVenta >= 0)
);
GO

CREATE TABLE dbo.VentaDetalle
(
    VentaDetalleID   INT IDENTITY(1,1) NOT NULL,
    VentaID          INT NOT NULL,
    ProductoID       INT NOT NULL,
    Cantidad         INT NOT NULL,
    PrecioUnitario   DECIMAL(18,2) NOT NULL,
    Subtotal AS (CONVERT(DECIMAL(18,2), Cantidad * PrecioUnitario)) PERSISTED,
    CONSTRAINT PK_VentaDetalle PRIMARY KEY (VentaDetalleID),
    CONSTRAINT FK_VentaDetalle_Venta FOREIGN KEY (VentaID)
        REFERENCES dbo.Venta(VentaID),
    CONSTRAINT FK_VentaDetalle_Producto FOREIGN KEY (ProductoID)
        REFERENCES dbo.Producto(ProductoID),
    CONSTRAINT UQ_VentaDetalle_Producto UNIQUE (VentaID, ProductoID),
    CONSTRAINT CK_VentaDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_VentaDetalle_Precio CHECK (PrecioUnitario >= 0)
);
GO

CREATE INDEX IX_Venta_Sucursal_Fecha ON dbo.Venta(SucursalID, FechaVenta);
CREATE INDEX IX_Venta_Cliente ON dbo.Venta(ClienteID);
CREATE INDEX IX_VentaDetalle_Producto ON dbo.VentaDetalle(ProductoID);
GO

/* 9. TRANSFERENCIAS ENTRE SUCURSALES */
CREATE TABLE dbo.Transferencia
(
    TransferenciaID          INT IDENTITY(1,1) NOT NULL,
    CodigoReferencia         NVARCHAR(60) NOT NULL,
    SucursalOrigenID         INT NOT NULL,
    SucursalDestinoID        INT NOT NULL,
    UsuarioSolicitaID        INT NOT NULL,
    UsuarioConfirmaID        INT NULL,
    FechaSolicitud           DATETIME2(0) NOT NULL CONSTRAINT DF_Transferencia_FechaSolicitud DEFAULT (SYSUTCDATETIME()),
    FechaConfirmacion        DATETIME2(0) NULL,
    Estado                   NVARCHAR(15) NOT NULL CONSTRAINT DF_Transferencia_Estado DEFAULT (N'SOLICITADA'),
    Observaciones            NVARCHAR(300) NULL,
    CONSTRAINT PK_Transferencia PRIMARY KEY (TransferenciaID),
    CONSTRAINT FK_Transferencia_Origen FOREIGN KEY (SucursalOrigenID)
        REFERENCES dbo.Sucursal(SucursalID),
    CONSTRAINT FK_Transferencia_Destino FOREIGN KEY (SucursalDestinoID)
        REFERENCES dbo.Sucursal(SucursalID),
    CONSTRAINT FK_Transferencia_UsuarioSolicita FOREIGN KEY (UsuarioSolicitaID)
        REFERENCES dbo.Usuario(UsuarioID),
    CONSTRAINT FK_Transferencia_UsuarioConfirma FOREIGN KEY (UsuarioConfirmaID)
        REFERENCES dbo.Usuario(UsuarioID),
    CONSTRAINT UQ_Transferencia_Codigo UNIQUE (CodigoReferencia),
    CONSTRAINT CK_Transferencia_Sucursales CHECK (SucursalOrigenID <> SucursalDestinoID),
    CONSTRAINT CK_Transferencia_Estado CHECK (Estado IN (N'SOLICITADA', N'CONFIRMADA', N'CANCELADA'))
);
GO

CREATE TABLE dbo.TransferenciaDetalle
(
    TransferenciaDetalleID  INT IDENTITY(1,1) NOT NULL,
    TransferenciaID         INT NOT NULL,
    ProductoID              INT NOT NULL,
    Cantidad                INT NOT NULL,
    CONSTRAINT PK_TransferenciaDetalle PRIMARY KEY (TransferenciaDetalleID),
    CONSTRAINT FK_TransferenciaDetalle_Transferencia FOREIGN KEY (TransferenciaID)
        REFERENCES dbo.Transferencia(TransferenciaID),
    CONSTRAINT FK_TransferenciaDetalle_Producto FOREIGN KEY (ProductoID)
        REFERENCES dbo.Producto(ProductoID),
    CONSTRAINT UQ_TransferenciaDetalle_Producto UNIQUE (TransferenciaID, ProductoID),
    CONSTRAINT CK_TransferenciaDetalle_Cantidad CHECK (Cantidad > 0)
);
GO

CREATE INDEX IX_Transferencia_Origen_Fecha ON dbo.Transferencia(SucursalOrigenID, FechaSolicitud);
CREATE INDEX IX_Transferencia_Destino_Fecha ON dbo.Transferencia(SucursalDestinoID, FechaSolicitud);
GO

/* 10. HISTORIAL CENTRALIZADO DE MOVIMIENTOS */
CREATE TABLE dbo.MovimientoInventario
(
    MovimientoID       BIGINT IDENTITY(1,1) NOT NULL,
    ProductoID         INT NOT NULL,
    SucursalID         INT NOT NULL,
    TipoMovimiento     NVARCHAR(30) NOT NULL,
    Cantidad           INT NOT NULL,
    FechaHora          DATETIME2(0) NOT NULL CONSTRAINT DF_Movimiento_Fecha DEFAULT (SYSUTCDATETIME()),
    UsuarioID          INT NOT NULL,
    CompraID           INT NULL,
    VentaID            INT NULL,
    TransferenciaID    INT NULL,
    Observaciones      NVARCHAR(300) NULL,
    CONSTRAINT PK_MovimientoInventario PRIMARY KEY (MovimientoID),
    CONSTRAINT FK_Movimiento_Producto FOREIGN KEY (ProductoID)
        REFERENCES dbo.Producto(ProductoID),
    CONSTRAINT FK_Movimiento_Sucursal FOREIGN KEY (SucursalID)
        REFERENCES dbo.Sucursal(SucursalID),
    CONSTRAINT FK_Movimiento_Usuario FOREIGN KEY (UsuarioID)
        REFERENCES dbo.Usuario(UsuarioID),
    CONSTRAINT FK_Movimiento_Compra FOREIGN KEY (CompraID)
        REFERENCES dbo.Compra(CompraID),
    CONSTRAINT FK_Movimiento_Venta FOREIGN KEY (VentaID)
        REFERENCES dbo.Venta(VentaID),
    CONSTRAINT FK_Movimiento_Transferencia FOREIGN KEY (TransferenciaID)
        REFERENCES dbo.Transferencia(TransferenciaID),
    CONSTRAINT CK_Movimiento_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_Movimiento_Tipo CHECK
        (TipoMovimiento IN
            (N'COMPRA', N'VENTA', N'TRANSFERENCIA_SALIDA', N'TRANSFERENCIA_ENTRADA',
             N'AJUSTE_ENTRADA', N'AJUSTE_SALIDA')),
    CONSTRAINT CK_Movimiento_Referencia CHECK
        (
            (TipoMovimiento = N'COMPRA' AND CompraID IS NOT NULL AND VentaID IS NULL AND TransferenciaID IS NULL)
            OR (TipoMovimiento = N'VENTA' AND CompraID IS NULL AND VentaID IS NOT NULL AND TransferenciaID IS NULL)
            OR (TipoMovimiento IN (N'TRANSFERENCIA_SALIDA', N'TRANSFERENCIA_ENTRADA')
                AND CompraID IS NULL AND VentaID IS NULL AND TransferenciaID IS NOT NULL)
            OR (TipoMovimiento IN (N'AJUSTE_ENTRADA', N'AJUSTE_SALIDA')
                AND CompraID IS NULL AND VentaID IS NULL AND TransferenciaID IS NULL)
        )
);
GO

CREATE INDEX IX_Movimiento_Sucursal_Fecha
    ON dbo.MovimientoInventario(SucursalID, FechaHora DESC);
CREATE INDEX IX_Movimiento_Producto_Fecha
    ON dbo.MovimientoInventario(ProductoID, FechaHora DESC);
CREATE INDEX IX_Movimiento_Usuario_Fecha
    ON dbo.MovimientoInventario(UsuarioID, FechaHora DESC);
GO

/* 11. ALERTAS DE EXISTENCIAS BAJAS */
CREATE TABLE dbo.AlertaInventario
(
    AlertaID                  BIGINT IDENTITY(1,1) NOT NULL,
    ProductoID                INT NOT NULL,
    SucursalID                INT NOT NULL,
    CantidadAlGenerarse       INT NOT NULL,
    StockMinimoAlGenerarse    INT NOT NULL,
    FechaGeneracion           DATETIME2(0) NOT NULL CONSTRAINT DF_Alerta_Fecha DEFAULT (SYSUTCDATETIME()),
    FechaAtencion             DATETIME2(0) NULL,
    Estado                    NVARCHAR(10) NOT NULL CONSTRAINT DF_Alerta_Estado DEFAULT (N'ACTIVA'),
    CONSTRAINT PK_AlertaInventario PRIMARY KEY (AlertaID),
    CONSTRAINT FK_Alerta_Inventario FOREIGN KEY (ProductoID, SucursalID)
        REFERENCES dbo.InventarioSucursal(ProductoID, SucursalID),
    CONSTRAINT CK_Alerta_Cantidad CHECK (CantidadAlGenerarse >= 0),
    CONSTRAINT CK_Alerta_StockMinimo CHECK (StockMinimoAlGenerarse >= 0),
    CONSTRAINT CK_Alerta_Estado CHECK (Estado IN (N'ACTIVA', N'ATENDIDA'))
);
GO

/* Solo puede existir una alerta activa por producto y sucursal. */
CREATE UNIQUE INDEX UX_Alerta_Activa_Producto_Sucursal
    ON dbo.AlertaInventario(ProductoID, SucursalID)
    WHERE Estado = N'ACTIVA';
GO

CREATE INDEX IX_Alerta_Estado_Fecha
    ON dbo.AlertaInventario(Estado, FechaGeneracion DESC);
GO

/* 12. DATOS INICIALES: ROLES Y PERMISOS */
INSERT INTO dbo.Rol(Nombre, Descripcion)
SELECT v.Nombre, v.Descripcion
FROM (VALUES
    (N'Administrador', N'Gestion general del sistema.'),
    (N'Gerente', N'Consulta de operaciones y generacion de reportes.'),
    (N'Encargado de inventario', N'Control de existencias, compras y transferencias.'),
    (N'Encargado de sucursal', N'Supervision de las operaciones de su sucursal.'),
    (N'Vendedor', N'Consulta de productos y registro de ventas.')
) AS v(Nombre, Descripcion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Rol r WHERE r.Nombre = v.Nombre);
GO

INSERT INTO dbo.Permiso(Codigo, Descripcion)
SELECT v.Codigo, v.Descripcion
FROM (VALUES
    (N'USUARIOS.GESTIONAR', N'Registrar, modificar y desactivar usuarios.'),
    (N'ROLES.GESTIONAR', N'Administrar roles y permisos.'),
    (N'UBICACIONES.GESTIONAR', N'Administrar paises, divisiones, ciudades y sucursales.'),
    (N'PRODUCTOS.GESTIONAR', N'Administrar categorias y productos.'),
    (N'PRODUCTOS.CONSULTAR', N'Consultar el catalogo de productos.'),
    (N'INVENTARIO.CONSULTAR', N'Consultar existencias por sucursal.'),
    (N'INVENTARIO.AJUSTAR', N'Registrar ajustes y controlar stock.'),
    (N'COMPRAS.REGISTRAR', N'Registrar y recibir compras.'),
    (N'COMPRAS.CONSULTAR', N'Consultar compras registradas.'),
    (N'VENTAS.REGISTRAR', N'Registrar y confirmar ventas.'),
    (N'VENTAS.CONSULTAR', N'Consultar ventas registradas.'),
    (N'TRANSFERENCIAS.GESTIONAR', N'Solicitar y confirmar transferencias.'),
    (N'TRANSFERENCIAS.CONSULTAR', N'Consultar transferencias registradas.'),
    (N'MOVIMIENTOS.CONSULTAR', N'Consultar el historial de movimientos.'),
    (N'REPORTES.GENERAR', N'Consultar y generar reportes.')
) AS v(Codigo, Descripcion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permiso p WHERE p.Codigo = v.Codigo);
GO

/* Administrador: todos los permisos registrados. */
INSERT INTO dbo.RolPermiso(RolID, PermisoID)
SELECT r.RolID, p.PermisoID
FROM dbo.Rol r
CROSS JOIN dbo.Permiso p
WHERE r.Nombre = N'Administrador'
  AND NOT EXISTS
      (SELECT 1 FROM dbo.RolPermiso rp WHERE rp.RolID = r.RolID AND rp.PermisoID = p.PermisoID);
GO

/* Gerente: consulta y reportes. */
INSERT INTO dbo.RolPermiso(RolID, PermisoID)
SELECT r.RolID, p.PermisoID
FROM dbo.Rol r
JOIN dbo.Permiso p ON p.Codigo IN
    (N'PRODUCTOS.CONSULTAR', N'INVENTARIO.CONSULTAR', N'COMPRAS.CONSULTAR',
     N'VENTAS.CONSULTAR', N'TRANSFERENCIAS.CONSULTAR', N'MOVIMIENTOS.CONSULTAR', N'REPORTES.GENERAR')
WHERE r.Nombre = N'Gerente'
  AND NOT EXISTS
      (SELECT 1 FROM dbo.RolPermiso rp WHERE rp.RolID = r.RolID AND rp.PermisoID = p.PermisoID);
GO

/* Encargado de inventario: existencias, compras, transferencias y movimientos. */
INSERT INTO dbo.RolPermiso(RolID, PermisoID)
SELECT r.RolID, p.PermisoID
FROM dbo.Rol r
JOIN dbo.Permiso p ON p.Codigo IN
    (N'PRODUCTOS.CONSULTAR', N'INVENTARIO.CONSULTAR', N'INVENTARIO.AJUSTAR',
     N'COMPRAS.REGISTRAR', N'COMPRAS.CONSULTAR', N'TRANSFERENCIAS.GESTIONAR',
     N'TRANSFERENCIAS.CONSULTAR', N'MOVIMIENTOS.CONSULTAR', N'REPORTES.GENERAR')
WHERE r.Nombre = N'Encargado de inventario'
  AND NOT EXISTS
      (SELECT 1 FROM dbo.RolPermiso rp WHERE rp.RolID = r.RolID AND rp.PermisoID = p.PermisoID);
GO

/* Encargado de sucursal: consulta y supervision de operaciones de inventario. */
INSERT INTO dbo.RolPermiso(RolID, PermisoID)
SELECT r.RolID, p.PermisoID
FROM dbo.Rol r
JOIN dbo.Permiso p ON p.Codigo IN
    (N'PRODUCTOS.CONSULTAR', N'INVENTARIO.CONSULTAR', N'MOVIMIENTOS.CONSULTAR', N'REPORTES.GENERAR')
WHERE r.Nombre = N'Encargado de sucursal'
  AND NOT EXISTS
      (SELECT 1 FROM dbo.RolPermiso rp WHERE rp.RolID = r.RolID AND rp.PermisoID = p.PermisoID);
GO

/* Vendedor: consulta de existencias y registro de ventas. */
INSERT INTO dbo.RolPermiso(RolID, PermisoID)
SELECT r.RolID, p.PermisoID
FROM dbo.Rol r
JOIN dbo.Permiso p ON p.Codigo IN
    (N'PRODUCTOS.CONSULTAR', N'INVENTARIO.CONSULTAR', N'VENTAS.REGISTRAR')
WHERE r.Nombre = N'Vendedor'
  AND NOT EXISTS
      (SELECT 1 FROM dbo.RolPermiso rp WHERE rp.RolID = r.RolID AND rp.PermisoID = p.PermisoID);
GO

/* 13. VISTAS PARA CONSULTAS Y REPORTES */
CREATE OR ALTER VIEW dbo.vw_InventarioPorSucursal
AS
SELECT
    i.ProductoID,
    p.Codigo AS CodigoProducto,
    p.Nombre AS Producto,
    c.Nombre AS Categoria,
    i.SucursalID,
    s.CodigoSucursal,
    s.Nombre AS Sucursal,
    ci.Nombre AS Ciudad,
    dt.Nombre AS DivisionTerritorial,
    dt.TipoDivision,
    pa.Nombre AS Pais,
    i.Cantidad,
    i.Disponible,
    COALESCE(i.StockMinimoOverride, p.StockMinimo) AS StockMinimoAplicado,
    COALESCE(i.StockMaximoOverride, p.StockMaximo) AS StockMaximoAplicado,
    CASE WHEN i.Cantidad <= COALESCE(i.StockMinimoOverride, p.StockMinimo)
         THEN CONVERT(BIT, 1) ELSE CONVERT(BIT, 0) END AS TieneStockBajo,
    i.FechaActualizacion
FROM dbo.InventarioSucursal i
JOIN dbo.Producto p ON p.ProductoID = i.ProductoID
JOIN dbo.Categoria c ON c.CategoriaID = p.CategoriaID
JOIN dbo.Sucursal s ON s.SucursalID = i.SucursalID
JOIN dbo.Ciudad ci ON ci.CiudadID = s.CiudadID
JOIN dbo.DivisionTerritorial dt ON dt.DivisionTerritorialID = ci.DivisionTerritorialID
JOIN dbo.Pais pa ON pa.PaisID = dt.PaisID;
GO

CREATE OR ALTER VIEW dbo.vw_ProductosBajoStock
AS
SELECT *
FROM dbo.vw_InventarioPorSucursal
WHERE TieneStockBajo = 1;
GO

CREATE OR ALTER VIEW dbo.vw_DisponibilidadGlobal
AS
SELECT
    ProductoID,
    CodigoProducto,
    Producto,
    Categoria,
    Pais,
    DivisionTerritorial,
    TipoDivision,
    Ciudad,
    Sucursal,
    Cantidad AS Existencias
FROM dbo.vw_InventarioPorSucursal
WHERE Cantidad > 0;
GO

CREATE OR ALTER VIEW dbo.vw_HistorialMovimientos
AS
SELECT
    m.MovimientoID,
    m.FechaHora,
    m.TipoMovimiento,
    m.ProductoID,
    p.Codigo AS CodigoProducto,
    p.Nombre AS Producto,
    m.Cantidad,
    m.SucursalID,
    s.Nombre AS Sucursal,
    pa.Nombre AS Pais,
    u.UsuarioID,
    u.Nombre AS UsuarioResponsable,
    m.CompraID,
    m.VentaID,
    m.TransferenciaID,
    m.Observaciones
FROM dbo.MovimientoInventario m
JOIN dbo.Producto p ON p.ProductoID = m.ProductoID
JOIN dbo.Sucursal s ON s.SucursalID = m.SucursalID
JOIN dbo.Ciudad ci ON ci.CiudadID = s.CiudadID
JOIN dbo.DivisionTerritorial dt ON dt.DivisionTerritorialID = ci.DivisionTerritorialID
JOIN dbo.Pais pa ON pa.PaisID = dt.PaisID
JOIN dbo.Usuario u ON u.UsuarioID = m.UsuarioID;
GO

CREATE OR ALTER VIEW dbo.vw_ReporteVentas
AS
SELECT
    v.VentaID,
    v.NumeroComprobante,
    v.FechaVenta,
    v.Estado,
    s.SucursalID,
    s.Nombre AS Sucursal,
    p.ProductoID,
    p.Codigo AS CodigoProducto,
    p.Nombre AS Producto,
    cat.Nombre AS Categoria,
    d.Cantidad,
    d.PrecioUnitario,
    d.Subtotal,
    v.TotalVenta,
    u.Nombre AS Vendedor,
    cl.Nombre AS Cliente
FROM dbo.Venta v
JOIN dbo.Sucursal s ON s.SucursalID = v.SucursalID
JOIN dbo.VentaDetalle d ON d.VentaID = v.VentaID
JOIN dbo.Producto p ON p.ProductoID = d.ProductoID
JOIN dbo.Categoria cat ON cat.CategoriaID = p.CategoriaID
JOIN dbo.Usuario u ON u.UsuarioID = v.UsuarioRegistroID
LEFT JOIN dbo.Cliente cl ON cl.ClienteID = v.ClienteID;
GO

CREATE OR ALTER VIEW dbo.vw_ReporteCompras
AS
SELECT
    c.CompraID,
    c.NumeroFactura,
    c.FechaCompra,
    c.FechaRecepcion,
    c.Estado,
    pr.ProveedorID,
    pr.NombreEmpresa AS Proveedor,
    s.SucursalID,
    s.Nombre AS SucursalDestino,
    p.ProductoID,
    p.Codigo AS CodigoProducto,
    p.Nombre AS Producto,
    cat.Nombre AS Categoria,
    d.Cantidad,
    d.CostoUnitario,
    d.Subtotal,
    c.TotalCompra
FROM dbo.Compra c
JOIN dbo.Proveedor pr ON pr.ProveedorID = c.ProveedorID
JOIN dbo.Sucursal s ON s.SucursalID = c.SucursalDestinoID
JOIN dbo.CompraDetalle d ON d.CompraID = c.CompraID
JOIN dbo.Producto p ON p.ProductoID = d.ProductoID
JOIN dbo.Categoria cat ON cat.CategoriaID = p.CategoriaID;
GO

CREATE OR ALTER VIEW dbo.vw_ReporteTransferencias
AS
SELECT
    t.TransferenciaID,
    t.CodigoReferencia,
    t.FechaSolicitud,
    t.FechaConfirmacion,
    t.Estado,
    so.Nombre AS SucursalOrigen,
    sd.Nombre AS SucursalDestino,
    p.ProductoID,
    p.Codigo AS CodigoProducto,
    p.Nombre AS Producto,
    d.Cantidad,
    us.Nombre AS UsuarioSolicitante,
    uc.Nombre AS UsuarioConfirmador
FROM dbo.Transferencia t
JOIN dbo.Sucursal so ON so.SucursalID = t.SucursalOrigenID
JOIN dbo.Sucursal sd ON sd.SucursalID = t.SucursalDestinoID
JOIN dbo.TransferenciaDetalle d ON d.TransferenciaID = t.TransferenciaID
JOIN dbo.Producto p ON p.ProductoID = d.ProductoID
JOIN dbo.Usuario us ON us.UsuarioID = t.UsuarioSolicitaID
LEFT JOIN dbo.Usuario uc ON uc.UsuarioID = t.UsuarioConfirmaID;
GO

/* 14. PROCEDIMIENTO INTERNO: ACTUALIZAR ALERTAS DE STOCK */
CREATE OR ALTER PROCEDURE dbo.usp_RefrescarAlertasStock
AS
BEGIN
    SET NOCOUNT ON;

    /* Cierra las alertas cuando la existencia supera el minimo aplicable. */
    UPDATE a
       SET a.Estado = N'ATENDIDA',
           a.FechaAtencion = SYSUTCDATETIME()
    FROM dbo.AlertaInventario a
    JOIN dbo.InventarioSucursal i
      ON i.ProductoID = a.ProductoID
     AND i.SucursalID = a.SucursalID
    JOIN dbo.Producto p ON p.ProductoID = i.ProductoID
    WHERE a.Estado = N'ACTIVA'
      AND i.Cantidad > COALESCE(i.StockMinimoOverride, p.StockMinimo);

    /* Crea una alerta solo si no existe otra alerta activa para ese producto/sucursal. */
    INSERT INTO dbo.AlertaInventario
        (ProductoID, SucursalID, CantidadAlGenerarse, StockMinimoAlGenerarse)
    SELECT
        i.ProductoID,
        i.SucursalID,
        i.Cantidad,
        COALESCE(i.StockMinimoOverride, p.StockMinimo)
    FROM dbo.InventarioSucursal i
    JOIN dbo.Producto p ON p.ProductoID = i.ProductoID
    WHERE i.Cantidad <= COALESCE(i.StockMinimoOverride, p.StockMinimo)
      AND NOT EXISTS
      (
          SELECT 1
          FROM dbo.AlertaInventario a WITH (UPDLOCK, HOLDLOCK)
          WHERE a.ProductoID = i.ProductoID
            AND a.SucursalID = i.SucursalID
            AND a.Estado = N'ACTIVA'
      );
END;
GO

/* 15. PROCEDIMIENTOS PARA OPERACIONES */

/* Crear usuario con al menos un rol asignado. */
CREATE OR ALTER PROCEDURE dbo.usp_CrearUsuario
    @Nombre        NVARCHAR(150),
    @Correo        NVARCHAR(150),
    @PasswordHash  NVARCHAR(255),
    @RolID         INT,
    @SucursalID    INT = NULL,
    @UsuarioID     INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.Rol WHERE RolID = @RolID AND Activo = 1)
            THROW 51001, 'El rol indicado no existe o esta inactivo.', 1;

        INSERT INTO dbo.Usuario(Nombre, Correo, PasswordHash)
        VALUES (@Nombre, @Correo, @PasswordHash);

        SET @UsuarioID = CONVERT(INT, SCOPE_IDENTITY());

        INSERT INTO dbo.UsuarioRol(UsuarioID, RolID)
        VALUES (@UsuarioID, @RolID);

        IF @SucursalID IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.Sucursal WHERE SucursalID = @SucursalID AND Activa = 1)
                THROW 51002, 'La sucursal indicada no existe o esta inactiva.', 1;

            INSERT INTO dbo.UsuarioSucursal(UsuarioID, SucursalID, EsPrincipal)
            VALUES (@UsuarioID, @SucursalID, 1);
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* Asignar roles adicionales sin duplicar la relacion. */
CREATE OR ALTER PROCEDURE dbo.usp_AsignarRolUsuario
    @UsuarioID INT,
    @RolID     INT,
    @AsignadoPorUsuarioID INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE UsuarioID = @UsuarioID AND Activo = 1)
        THROW 51003, 'El usuario no existe o esta inactivo.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Rol WHERE RolID = @RolID AND Activo = 1)
        THROW 51004, 'El rol no existe o esta inactivo.', 1;

    IF NOT EXISTS
       (SELECT 1 FROM dbo.UsuarioRol WHERE UsuarioID = @UsuarioID AND RolID = @RolID)
    BEGIN
        INSERT INTO dbo.UsuarioRol(UsuarioID, RolID, AsignadoPorUsuarioID)
        VALUES (@UsuarioID, @RolID, @AsignadoPorUsuarioID);
    END;
END;
GO

/* Recibir una compra: suma las cantidades a la sucursal destino una sola vez. */
CREATE OR ALTER PROCEDURE dbo.usp_ConfirmarCompra
    @CompraID  INT,
    @UsuarioID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @SucursalID INT;
    DECLARE @Estado NVARCHAR(15);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @SucursalID = SucursalDestinoID, @Estado = Estado
        FROM dbo.Compra WITH (UPDLOCK, HOLDLOCK)
        WHERE CompraID = @CompraID;

        IF @Estado IS NULL
            THROW 51010, 'La compra indicada no existe.', 1;
        IF @Estado <> N'REGISTRADA'
            THROW 51011, 'La compra no esta en estado REGISTRADA o ya fue procesada.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.CompraDetalle WHERE CompraID = @CompraID)
            THROW 51012, 'La compra debe contener al menos un producto.', 1;

        /* Crea filas de inventario que aun no existan para la sucursal destino. */
        INSERT INTO dbo.InventarioSucursal(ProductoID, SucursalID, Cantidad)
        SELECT d.ProductoID, @SucursalID, 0
        FROM dbo.CompraDetalle d
        WHERE d.CompraID = @CompraID
          AND NOT EXISTS
          (
              SELECT 1
              FROM dbo.InventarioSucursal i WITH (UPDLOCK, HOLDLOCK)
              WHERE i.ProductoID = d.ProductoID
                AND i.SucursalID = @SucursalID
          );

        /* Actualiza existencias. */
        ;WITH Cantidades AS
        (
            SELECT ProductoID, SUM(Cantidad) AS CantidadRecibida
            FROM dbo.CompraDetalle
            WHERE CompraID = @CompraID
            GROUP BY ProductoID
        )
        UPDATE i
           SET i.Cantidad = i.Cantidad + c.CantidadRecibida,
               i.FechaActualizacion = SYSUTCDATETIME()
        FROM dbo.InventarioSucursal i
        JOIN Cantidades c ON c.ProductoID = i.ProductoID
        WHERE i.SucursalID = @SucursalID;

        INSERT INTO dbo.MovimientoInventario
            (ProductoID, SucursalID, TipoMovimiento, Cantidad, UsuarioID, CompraID, Observaciones)
        SELECT
            d.ProductoID, @SucursalID, N'COMPRA', d.Cantidad, @UsuarioID, @CompraID,
            N'Entrada por recepcion de compra.'
        FROM dbo.CompraDetalle d
        WHERE d.CompraID = @CompraID;

        UPDATE dbo.Compra
           SET Estado = N'RECIBIDA',
               FechaRecepcion = SYSUTCDATETIME(),
               UsuarioRecepcionID = @UsuarioID,
               TotalCompra =
                   (SELECT SUM(Subtotal) FROM dbo.CompraDetalle WHERE CompraID = @CompraID)
        WHERE CompraID = @CompraID;

        EXEC dbo.usp_RefrescarAlertasStock;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* Confirmar venta: valida stock y descuenta las existencias en una transaccion. */
CREATE OR ALTER PROCEDURE dbo.usp_ConfirmarVenta
    @VentaID   INT,
    @UsuarioID INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @SucursalID INT;
    DECLARE @Estado NVARCHAR(15);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @SucursalID = SucursalID, @Estado = Estado
        FROM dbo.Venta WITH (UPDLOCK, HOLDLOCK)
        WHERE VentaID = @VentaID;

        IF @Estado IS NULL
            THROW 51020, 'La venta indicada no existe.', 1;
        IF @Estado <> N'REGISTRADA'
            THROW 51021, 'La venta no esta en estado REGISTRADA o ya fue procesada.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.VentaDetalle WHERE VentaID = @VentaID)
            THROW 51022, 'La venta debe contener al menos un producto.', 1;

        /* RN03: no se permite vender mas unidades que las disponibles. */
        IF EXISTS
        (
            SELECT 1
            FROM dbo.VentaDetalle d
            LEFT JOIN dbo.InventarioSucursal i WITH (UPDLOCK, HOLDLOCK)
              ON i.ProductoID = d.ProductoID
             AND i.SucursalID = @SucursalID
            WHERE d.VentaID = @VentaID
              AND (i.ProductoID IS NULL OR i.Cantidad < d.Cantidad)
        )
            THROW 51023, 'Existencias insuficientes para confirmar la venta.', 1;

        ;WITH Cantidades AS
        (
            SELECT ProductoID, SUM(Cantidad) AS CantidadVendida
            FROM dbo.VentaDetalle
            WHERE VentaID = @VentaID
            GROUP BY ProductoID
        )
        UPDATE i
           SET i.Cantidad = i.Cantidad - c.CantidadVendida,
               i.FechaActualizacion = SYSUTCDATETIME()
        FROM dbo.InventarioSucursal i
        JOIN Cantidades c ON c.ProductoID = i.ProductoID
        WHERE i.SucursalID = @SucursalID;

        INSERT INTO dbo.MovimientoInventario
            (ProductoID, SucursalID, TipoMovimiento, Cantidad, UsuarioID, VentaID, Observaciones)
        SELECT
            d.ProductoID, @SucursalID, N'VENTA', d.Cantidad, @UsuarioID, @VentaID,
            N'Salida por venta confirmada.'
        FROM dbo.VentaDetalle d
        WHERE d.VentaID = @VentaID;

        UPDATE dbo.Venta
           SET Estado = N'CONFIRMADA',
               FechaConfirmacion = SYSUTCDATETIME(),
               UsuarioConfirmacionID = @UsuarioID,
               TotalVenta =
                   (SELECT SUM(Subtotal) FROM dbo.VentaDetalle WHERE VentaID = @VentaID)
        WHERE VentaID = @VentaID;

        EXEC dbo.usp_RefrescarAlertasStock;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* Confirmar transferencia: descuenta en origen y suma en destino atomicamente. */
CREATE OR ALTER PROCEDURE dbo.usp_ConfirmarTransferencia
    @TransferenciaID INT,
    @UsuarioID       INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @SucursalOrigenID INT;
    DECLARE @SucursalDestinoID INT;
    DECLARE @Estado NVARCHAR(15);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @SucursalOrigenID = SucursalOrigenID,
            @SucursalDestinoID = SucursalDestinoID,
            @Estado = Estado
        FROM dbo.Transferencia WITH (UPDLOCK, HOLDLOCK)
        WHERE TransferenciaID = @TransferenciaID;

        IF @Estado IS NULL
            THROW 51030, 'La transferencia indicada no existe.', 1;
        IF @Estado <> N'SOLICITADA'
            THROW 51031, 'La transferencia no esta en estado SOLICITADA o ya fue procesada.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.TransferenciaDetalle WHERE TransferenciaID = @TransferenciaID)
            THROW 51032, 'La transferencia debe contener al menos un producto.', 1;

        /* RN06: la sucursal origen debe disponer de toda la cantidad solicitada. */
        IF EXISTS
        (
            SELECT 1
            FROM dbo.TransferenciaDetalle d
            LEFT JOIN dbo.InventarioSucursal i WITH (UPDLOCK, HOLDLOCK)
              ON i.ProductoID = d.ProductoID
             AND i.SucursalID = @SucursalOrigenID
            WHERE d.TransferenciaID = @TransferenciaID
              AND (i.ProductoID IS NULL OR i.Cantidad < d.Cantidad)
        )
            THROW 51033, 'La sucursal de origen no posee existencias suficientes.', 1;

        /* Crea las filas faltantes de inventario en la sucursal destino. */
        INSERT INTO dbo.InventarioSucursal(ProductoID, SucursalID, Cantidad)
        SELECT d.ProductoID, @SucursalDestinoID, 0
        FROM dbo.TransferenciaDetalle d
        WHERE d.TransferenciaID = @TransferenciaID
          AND NOT EXISTS
          (
              SELECT 1
              FROM dbo.InventarioSucursal i WITH (UPDLOCK, HOLDLOCK)
              WHERE i.ProductoID = d.ProductoID
                AND i.SucursalID = @SucursalDestinoID
          );

        /* Egreso de la sucursal origen. */
        ;WITH Cantidades AS
        (
            SELECT ProductoID, SUM(Cantidad) AS CantidadTransferida
            FROM dbo.TransferenciaDetalle
            WHERE TransferenciaID = @TransferenciaID
            GROUP BY ProductoID
        )
        UPDATE i
           SET i.Cantidad = i.Cantidad - c.CantidadTransferida,
               i.FechaActualizacion = SYSUTCDATETIME()
        FROM dbo.InventarioSucursal i
        JOIN Cantidades c ON c.ProductoID = i.ProductoID
        WHERE i.SucursalID = @SucursalOrigenID;

        /* Ingreso en la sucursal destino. */
        ;WITH Cantidades AS
        (
            SELECT ProductoID, SUM(Cantidad) AS CantidadTransferida
            FROM dbo.TransferenciaDetalle
            WHERE TransferenciaID = @TransferenciaID
            GROUP BY ProductoID
        )
        UPDATE i
           SET i.Cantidad = i.Cantidad + c.CantidadTransferida,
               i.FechaActualizacion = SYSUTCDATETIME()
        FROM dbo.InventarioSucursal i
        JOIN Cantidades c ON c.ProductoID = i.ProductoID
        WHERE i.SucursalID = @SucursalDestinoID;

        /* Dos registros permiten rastrear la salida y la entrada por separado. */
        INSERT INTO dbo.MovimientoInventario
            (ProductoID, SucursalID, TipoMovimiento, Cantidad, UsuarioID, TransferenciaID, Observaciones)
        SELECT d.ProductoID, @SucursalOrigenID, N'TRANSFERENCIA_SALIDA', d.Cantidad,
               @UsuarioID, @TransferenciaID, N'Salida por transferencia.'
        FROM dbo.TransferenciaDetalle d
        WHERE d.TransferenciaID = @TransferenciaID
        UNION ALL
        SELECT d.ProductoID, @SucursalDestinoID, N'TRANSFERENCIA_ENTRADA', d.Cantidad,
               @UsuarioID, @TransferenciaID, N'Entrada por transferencia.'
        FROM dbo.TransferenciaDetalle d
        WHERE d.TransferenciaID = @TransferenciaID;

        UPDATE dbo.Transferencia
           SET Estado = N'CONFIRMADA',
               FechaConfirmacion = SYSUTCDATETIME(),
               UsuarioConfirmaID = @UsuarioID
        WHERE TransferenciaID = @TransferenciaID;

        EXEC dbo.usp_RefrescarAlertasStock;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* Ajuste manual del stock fisico. Un valor positivo es entrada; negativo es salida. */
CREATE OR ALTER PROCEDURE dbo.usp_RegistrarAjusteInventario
    @ProductoID    INT,
    @SucursalID    INT,
    @CantidadAjuste INT,
    @UsuarioID     INT,
    @Motivo        NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @CantidadAjuste = 0
        THROW 51040, 'El ajuste debe ser diferente de cero.', 1;
    IF NULLIF(LTRIM(RTRIM(@Motivo)), N'') IS NULL
        THROW 51041, 'Debe indicar el motivo del ajuste.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        /* Si es una entrada y aun no existe la fila, se crea con cantidad cero. */
        IF @CantidadAjuste > 0
        BEGIN
            INSERT INTO dbo.InventarioSucursal(ProductoID, SucursalID, Cantidad)
            SELECT @ProductoID, @SucursalID, 0
            WHERE NOT EXISTS
            (
                SELECT 1
                FROM dbo.InventarioSucursal WITH (UPDLOCK, HOLDLOCK)
                WHERE ProductoID = @ProductoID AND SucursalID = @SucursalID
            );
        END;

        /* Comprueba existencia de la fila y evita que el ajuste deje stock negativo. */
        IF NOT EXISTS
        (
            SELECT 1
            FROM dbo.InventarioSucursal WITH (UPDLOCK, HOLDLOCK)
            WHERE ProductoID = @ProductoID AND SucursalID = @SucursalID
        )
            THROW 51042, 'No existe inventario para aplicar una salida.', 1;

        IF EXISTS
        (
            SELECT 1
            FROM dbo.InventarioSucursal WITH (UPDLOCK, HOLDLOCK)
            WHERE ProductoID = @ProductoID
              AND SucursalID = @SucursalID
              AND Cantidad + @CantidadAjuste < 0
        )
            THROW 51043, 'El ajuste produciria una existencia negativa.', 1;

        UPDATE dbo.InventarioSucursal
           SET Cantidad = Cantidad + @CantidadAjuste,
               FechaActualizacion = SYSUTCDATETIME()
        WHERE ProductoID = @ProductoID
          AND SucursalID = @SucursalID;

        INSERT INTO dbo.MovimientoInventario
            (ProductoID, SucursalID, TipoMovimiento, Cantidad, UsuarioID, Observaciones)
        VALUES
            (@ProductoID, @SucursalID,
             CASE WHEN @CantidadAjuste > 0 THEN N'AJUSTE_ENTRADA' ELSE N'AJUSTE_SALIDA' END,
             ABS(@CantidadAjuste), @UsuarioID, @Motivo);

        EXEC dbo.usp_RefrescarAlertasStock;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* 16. EJEMPLOS DE CONSULTA (EJECUTAR POR SEPARADO CUANDO EXISTAN DATOS) */
/* Inventario de una sucursal:
SELECT *
FROM dbo.vw_InventarioPorSucursal
WHERE SucursalID = 1;
*/

/* Productos con stock minimo alcanzado o superado hacia abajo:
SELECT *
FROM dbo.vw_ProductosBajoStock
ORDER BY Pais, Sucursal, Producto;
*/

/* Disponibilidad de un producto en otras sucursales y paises:
SELECT *
FROM dbo.vw_DisponibilidadGlobal
WHERE ProductoID = 1
ORDER BY Pais, DivisionTerritorial, Ciudad, Sucursal;
*/

/* Historial de movimientos de un producto:
SELECT *
FROM dbo.vw_HistorialMovimientos
WHERE ProductoID = 1
ORDER BY FechaHora DESC;
*/

/* 17. FLUJO DE USO RESUMIDO

    A. Registrar los datos maestros: paises, divisiones, ciudades, sucursales,
       categorias, productos, proveedores, clientes y usuarios.
    B. Registrar compras y sus lineas en Compra / CompraDetalle.
       Ejecutar dbo.usp_ConfirmarCompra para recibir la compra e incrementar stock.
    C. Registrar ventas y sus lineas en Venta / VentaDetalle.
       Ejecutar dbo.usp_ConfirmarVenta para validar y descontar stock.
    D. Registrar transferencias y sus lineas en Transferencia / TransferenciaDetalle.
       Ejecutar dbo.usp_ConfirmarTransferencia para aplicar la salida y la entrada.
    E. Para correcciones de conteo fisico, ejecutar dbo.usp_RegistrarAjusteInventario.

    IMPORTANTE: la aplicacion debe validar permisos y asignaciones de sucursal antes
    de ejecutar los procedimientos. Para proteger la trazabilidad, no debe conceder
    a usuarios operativos permisos directos de UPDATE o DELETE sobre InventarioSucursal
    ni MovimientoInventario; deben operar mediante los procedimientos almacenados.
*/
