/*
 * Datos de demostración para el Sistema Centralizado de Inventario.
 * El script es idempotente: se puede ejecutar varias veces sin duplicar datos.
 *
 * Uso:  npm run seed
 */
const { database, passwordHasher } = require('./core/container');
const { sql } = require('./core/Database');

const query = (text, params) => database.query(text, params);
const getPool = () => database.getPool();
const hashPassword = (password) => passwordHasher.hash(password);
const closePool = () => database.close();

async function ensurePais(nombre, codigoISO2) {
    const found = await query('SELECT PaisID FROM dbo.Pais WHERE Nombre = @nombre', { nombre });
    if (found.recordset[0]) return found.recordset[0].PaisID;
    const result = await query(
        `INSERT INTO dbo.Pais (Nombre, CodigoISO2)
         OUTPUT INSERTED.PaisID VALUES (@nombre, @codigoISO2)`,
        { nombre, codigoISO2 }
    );
    return result.recordset[0].PaisID;
}

async function ensureDivision(paisId, tipoDivision, nombre) {
    const found = await query(
        `SELECT DivisionTerritorialID FROM dbo.DivisionTerritorial
          WHERE PaisID = @paisId AND TipoDivision = @tipoDivision AND Nombre = @nombre`,
        { paisId, tipoDivision, nombre }
    );
    if (found.recordset[0]) return found.recordset[0].DivisionTerritorialID;
    const result = await query(
        `INSERT INTO dbo.DivisionTerritorial (PaisID, TipoDivision, Nombre)
         OUTPUT INSERTED.DivisionTerritorialID
         VALUES (@paisId, @tipoDivision, @nombre)`,
        { paisId, tipoDivision, nombre }
    );
    return result.recordset[0].DivisionTerritorialID;
}

async function ensureCiudad(divisionId, nombre) {
    const found = await query(
        `SELECT CiudadID FROM dbo.Ciudad
          WHERE DivisionTerritorialID = @divisionId AND Nombre = @nombre`,
        { divisionId, nombre }
    );
    if (found.recordset[0]) return found.recordset[0].CiudadID;
    const result = await query(
        `INSERT INTO dbo.Ciudad (DivisionTerritorialID, Nombre)
         OUTPUT INSERTED.CiudadID VALUES (@divisionId, @nombre)`,
        { divisionId, nombre }
    );
    return result.recordset[0].CiudadID;
}

async function ensureSucursal(ciudadId, codigoSucursal, nombre, direccion, telefono) {
    const found = await query(
        'SELECT SucursalID FROM dbo.Sucursal WHERE CodigoSucursal = @codigoSucursal',
        { codigoSucursal }
    );
    if (found.recordset[0]) return found.recordset[0].SucursalID;
    const result = await query(
        `INSERT INTO dbo.Sucursal (CiudadID, CodigoSucursal, Nombre, Direccion, Telefono)
         OUTPUT INSERTED.SucursalID
         VALUES (@ciudadId, @codigoSucursal, @nombre, @direccion, @telefono)`,
        { ciudadId, codigoSucursal, nombre, direccion, telefono }
    );
    return result.recordset[0].SucursalID;
}

async function ensureCategoria(nombre, descripcion) {
    const found = await query('SELECT CategoriaID FROM dbo.Categoria WHERE Nombre = @nombre', { nombre });
    if (found.recordset[0]) return found.recordset[0].CategoriaID;
    const result = await query(
        `INSERT INTO dbo.Categoria (Nombre, Descripcion)
         OUTPUT INSERTED.CategoriaID VALUES (@nombre, @descripcion)`,
        { nombre, descripcion }
    );
    return result.recordset[0].CategoriaID;
}

async function ensureProducto(producto) {
    const found = await query('SELECT ProductoID FROM dbo.Producto WHERE Codigo = @codigo', {
        codigo: producto.codigo
    });
    if (found.recordset[0]) return found.recordset[0].ProductoID;
    const result = await query(
        `INSERT INTO dbo.Producto
             (CategoriaID, Codigo, Nombre, Descripcion, Marca, Modelo,
              PrecioVenta, StockMinimo, StockMaximo)
         OUTPUT INSERTED.ProductoID
         VALUES (@categoriaId, @codigo, @nombre, @descripcion, @marca, @modelo,
                 @precioVenta, @stockMinimo, @stockMaximo)`,
        producto
    );
    return result.recordset[0].ProductoID;
}

async function ensureProveedor(proveedor) {
    const found = await query(
        'SELECT ProveedorID FROM dbo.Proveedor WHERE NombreEmpresa = @nombreEmpresa',
        { nombreEmpresa: proveedor.nombreEmpresa }
    );
    if (found.recordset[0]) return found.recordset[0].ProveedorID;
    const result = await query(
        `INSERT INTO dbo.Proveedor
             (NombreEmpresa, NumeroIdentificacion, Direccion, Telefono, Correo)
         OUTPUT INSERTED.ProveedorID
         VALUES (@nombreEmpresa, @numeroIdentificacion, @direccion, @telefono, @correo)`,
        proveedor
    );
    return result.recordset[0].ProveedorID;
}

async function ensureCliente(cliente) {
    const found = await query(
        'SELECT ClienteID FROM dbo.Cliente WHERE Nombre = @nombre',
        { nombre: cliente.nombre }
    );
    if (found.recordset[0]) return found.recordset[0].ClienteID;
    const result = await query(
        `INSERT INTO dbo.Cliente (Nombre, NumeroDocumento, Telefono, Correo)
         OUTPUT INSERTED.ClienteID
         VALUES (@nombre, @numeroDocumento, @telefono, @correo)`,
        cliente
    );
    return result.recordset[0].ClienteID;
}

async function ensureUsuario(usuario, rolId, sucursalId) {
    const found = await query(
        'SELECT UsuarioID FROM dbo.Usuario WHERE LOWER(Correo) = @correo',
        { correo: usuario.correo.toLowerCase() }
    );
    if (found.recordset[0]) return found.recordset[0].UsuarioID;

    const pool = await getPool();
    const request = pool.request();
    request.input('Nombre', sql.NVarChar(150), usuario.nombre);
    request.input('Correo', sql.NVarChar(150), usuario.correo);
    request.input('PasswordHash', sql.NVarChar(255), hashPassword(usuario.password));
    request.input('RolID', sql.Int, rolId);
    request.input('SucursalID', sql.Int, sucursalId);
    request.output('UsuarioID', sql.Int);
    const result = await request.execute('dbo.usp_CrearUsuario');
    return result.output.UsuarioID;
}

async function ensureInventario(productoId, sucursalId, cantidad, minimoOverride = null, maximoOverride = null) {
    await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.InventarioSucursal
                         WHERE ProductoID = @productoId AND SucursalID = @sucursalId)
         BEGIN
             INSERT INTO dbo.InventarioSucursal
                 (ProductoID, SucursalID, Cantidad, StockMinimoOverride, StockMaximoOverride)
             VALUES (@productoId, @sucursalId, @cantidad, @minimoOverride, @maximoOverride)
         END`,
        { productoId, sucursalId, cantidad, minimoOverride, maximoOverride }
    );
}

async function crearCompraDemo({ proveedorId, sucursalId, usuarioId, numeroFactura, items }) {
    const existe = await query(
        `SELECT CompraID FROM dbo.Compra
          WHERE ProveedorID = @proveedorId AND NumeroFactura = @numeroFactura`,
        { proveedorId, numeroFactura }
    );
    if (existe.recordset[0]) return;

    const total = items.reduce((sum, i) => sum + i.cantidad * i.costoUnitario, 0);
    const header = await query(
        `INSERT INTO dbo.Compra
             (ProveedorID, SucursalDestinoID, UsuarioRegistroID,
              NumeroFactura, TotalCompra, Observaciones)
         OUTPUT INSERTED.CompraID
         VALUES (@proveedorId, @sucursalId, @usuarioId,
                 @numeroFactura, @total, N'Compra de demostración')`,
        { proveedorId, sucursalId, usuarioId, numeroFactura, total }
    );
    const compraId = header.recordset[0].CompraID;

    for (const item of items) {
        await query(
            `INSERT INTO dbo.CompraDetalle (CompraID, ProductoID, Cantidad, CostoUnitario)
             VALUES (@compraId, @productoId, @cantidad, @costoUnitario)`,
            { compraId, ...item }
        );
    }

    await query(
        'EXEC dbo.usp_ConfirmarCompra @CompraID = @compraId, @UsuarioID = @usuarioId',
        { compraId, usuarioId }
    );
}

async function crearVentaDemo({ sucursalId, clienteId, usuarioId, numeroComprobante, items }) {
    const existe = await query(
        `SELECT VentaID FROM dbo.Venta
          WHERE SucursalID = @sucursalId AND NumeroComprobante = @numeroComprobante`,
        { sucursalId, numeroComprobante }
    );
    if (existe.recordset[0]) return;

    const total = items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0);
    const header = await query(
        `INSERT INTO dbo.Venta
             (SucursalID, ClienteID, UsuarioRegistroID,
              NumeroComprobante, TotalVenta, Observaciones)
         OUTPUT INSERTED.VentaID
         VALUES (@sucursalId, @clienteId, @usuarioId,
                 @numeroComprobante, @total, N'Venta de demostración')`,
        { sucursalId, clienteId, usuarioId, numeroComprobante, total }
    );
    const ventaId = header.recordset[0].VentaID;

    for (const item of items) {
        await query(
            `INSERT INTO dbo.VentaDetalle (VentaID, ProductoID, Cantidad, PrecioUnitario)
             VALUES (@ventaId, @productoId, @cantidad, @precioUnitario)`,
            { ventaId, ...item }
        );
    }

    await query(
        'EXEC dbo.usp_ConfirmarVenta @VentaID = @ventaId, @UsuarioID = @usuarioId',
        { ventaId, usuarioId }
    );
}

async function crearTransferenciaDemo({ origenId, destinoId, usuarioId, codigo, items }) {
    const existe = await query(
        'SELECT TransferenciaID FROM dbo.Transferencia WHERE CodigoReferencia = @codigo',
        { codigo }
    );
    if (existe.recordset[0]) return;

    const header = await query(
        `INSERT INTO dbo.Transferencia
             (CodigoReferencia, SucursalOrigenID, SucursalDestinoID,
              UsuarioSolicitaID, Observaciones)
         OUTPUT INSERTED.TransferenciaID
         VALUES (@codigo, @origenId, @destinoId, @usuarioId, N'Transferencia de demostración')`,
        { codigo, origenId, destinoId, usuarioId }
    );
    const transferenciaId = header.recordset[0].TransferenciaID;

    for (const item of items) {
        await query(
            `INSERT INTO dbo.TransferenciaDetalle (TransferenciaID, ProductoID, Cantidad)
             VALUES (@transferenciaId, @productoId, @cantidad)`,
            { transferenciaId, ...item }
        );
    }

    await query(
        `EXEC dbo.usp_ConfirmarTransferencia
             @TransferenciaID = @transferenciaId, @UsuarioID = @usuarioId`,
        { transferenciaId, usuarioId }
    );
}

async function main() {
    console.log('Sembrando datos de demostración...');

    /* Geografía */
    const sv = await ensurePais('El Salvador', 'SV');
    const gt = await ensurePais('Guatemala', 'GT');
    const hn = await ensurePais('Honduras', 'HN');

    const sanSalvador = await ensureDivision(sv, 'Departamento', 'San Salvador');
    const laLibertad = await ensureDivision(sv, 'Departamento', 'La Libertad');
    const guatemalaDept = await ensureDivision(gt, 'Departamento', 'Guatemala');
    const cortes = await ensureDivision(hn, 'Departamento', 'Cortés');

    const ciudadSanSalvador = await ensureCiudad(sanSalvador, 'San Salvador');
    const ciudadSantaTecla = await ensureCiudad(laLibertad, 'Santa Tecla');
    const ciudadGuatemala = await ensureCiudad(guatemalaDept, 'Ciudad de Guatemala');
    const ciudadSanPedro = await ensureCiudad(cortes, 'San Pedro Sula');

    const central = await ensureSucursal(
        ciudadSanSalvador, 'SUC-001', 'Sucursal Central',
        'Calle Arce 123, San Salvador', '2222-1000'
    );
    const santaTecla = await ensureSucursal(
        ciudadSantaTecla, 'SUC-002', 'Sucursal Santa Tecla',
        'Av. Manuel Gallardo 45, Santa Tecla', '2222-2000'
    );
    const guatemala = await ensureSucursal(
        ciudadGuatemala, 'SUC-003', 'Sucursal Guatemala',
        'Zona 10, Ciudad de Guatemala', '2333-3000'
    );
    const sanPedro = await ensureSucursal(
        ciudadSanPedro, 'SUC-004', 'Sucursal San Pedro Sula',
        'Boulevard del Norte, San Pedro Sula', '2555-4000'
    );

    /* Catálogo */
    const catLaptops = await ensureCategoria('Laptops', 'Equipos portátiles.');
    const catMonitores = await ensureCategoria('Monitores', 'Pantallas y monitores.');
    const catPerifericos = await ensureCategoria('Periféricos', 'Teclados, mouse y accesorios.');
    const catAlmacenamiento = await ensureCategoria('Almacenamiento', 'Discos SSD y HDD.');
    const catRedes = await ensureCategoria('Redes', 'Routers, switches y conectividad.');

    const productos = [
        {
            codigo: 'LAP-001', nombre: 'Laptop Lenovo ThinkPad E14', categoriaId: catLaptops,
            descripcion: 'Laptop empresarial de 14 pulgadas.', marca: 'Lenovo', modelo: 'E14 Gen 5',
            precioVenta: 850.00, stockMinimo: 3, stockMaximo: 20
        },
        {
            codigo: 'LAP-002', nombre: 'Laptop HP Pavilion 15', categoriaId: catLaptops,
            descripcion: 'Laptop de uso general de 15.6 pulgadas.', marca: 'HP', modelo: 'Pavilion 15',
            precioVenta: 720.00, stockMinimo: 3, stockMaximo: 20
        },
        {
            codigo: 'MON-001', nombre: 'Monitor Dell 24"', categoriaId: catMonitores,
            descripcion: 'Monitor Full HD de 24 pulgadas.', marca: 'Dell', modelo: 'P2422H',
            precioVenta: 180.00, stockMinimo: 5, stockMaximo: 30
        },
        {
            codigo: 'MON-002', nombre: 'Monitor LG 27"', categoriaId: catMonitores,
            descripcion: 'Monitor IPS de 27 pulgadas.', marca: 'LG', modelo: '27MP400',
            precioVenta: 210.00, stockMinimo: 4, stockMaximo: 25
        },
        {
            codigo: 'PER-001', nombre: 'Teclado Logitech K120', categoriaId: catPerifericos,
            descripcion: 'Teclado USB de membrana.', marca: 'Logitech', modelo: 'K120',
            precioVenta: 15.00, stockMinimo: 10, stockMaximo: 100
        },
        {
            codigo: 'PER-002', nombre: 'Mouse Logitech M170', categoriaId: catPerifericos,
            descripcion: 'Mouse inalámbrico compacto.', marca: 'Logitech', modelo: 'M170',
            precioVenta: 12.00, stockMinimo: 10, stockMaximo: 100
        },
        {
            codigo: 'ALM-001', nombre: 'SSD Kingston A400 480GB', categoriaId: catAlmacenamiento,
            descripcion: 'Unidad de estado sólido SATA de 480 GB.', marca: 'Kingston', modelo: 'A400',
            precioVenta: 45.00, stockMinimo: 8, stockMaximo: 60
        },
        {
            codigo: 'ALM-002', nombre: 'Disco Seagate Barracuda 1TB', categoriaId: catAlmacenamiento,
            descripcion: 'Disco duro SATA de 1 TB.', marca: 'Seagate', modelo: 'Barracuda',
            precioVenta: 55.00, stockMinimo: 5, stockMaximo: 40
        },
        {
            codigo: 'RED-001', nombre: 'Router TP-Link Archer C6', categoriaId: catRedes,
            descripcion: 'Router inalámbrico AC1200.', marca: 'TP-Link', modelo: 'Archer C6',
            precioVenta: 40.00, stockMinimo: 4, stockMaximo: 30
        },
        {
            codigo: 'RED-002', nombre: 'Switch Cisco SF110D-08', categoriaId: catRedes,
            descripcion: 'Switch de 8 puertos 10/100.', marca: 'Cisco', modelo: 'SF110D-08',
            precioVenta: 65.00, stockMinimo: 3, stockMaximo: 20
        }
    ];

    const productosCreados = {};
    for (const producto of productos) {
        productosCreados[producto.codigo] = await ensureProducto(producto);
    }

    /* Proveedores y clientes */
    const proveedorTecno = await ensureProveedor({
        nombreEmpresa: 'TecnoDistribuidora S.A. de C.V.',
        numeroIdentificacion: '0614-123456-001-1',
        direccion: 'San Salvador, El Salvador',
        telefono: '2200-1111',
        correo: 'ventas@tecnodistribuidora.com'
    });
    await ensureProveedor({
        nombreEmpresa: 'Importadora Global GT',
        numeroIdentificacion: 'GT-99887766',
        direccion: 'Ciudad de Guatemala',
        telefono: '2300-2222',
        correo: 'compras@importadoraglobal.gt'
    });
    await ensureProveedor({
        nombreEmpresa: 'Suministros del Norte',
        numeroIdentificacion: 'HN-55443322',
        direccion: 'San Pedro Sula, Honduras',
        telefono: '2500-3333',
        correo: 'info@suministrosdelnorte.hn'
    });

    const clienteMaria = await ensureCliente({
        nombre: 'María López',
        numeroDocumento: '01234567-8',
        telefono: '7777-1111',
        correo: 'maria.lopez@example.com'
    });
    await ensureCliente({
        nombre: 'Carlos Hernández',
        numeroDocumento: '09876543-2',
        telefono: '7777-2222',
        correo: 'carlos.hernandez@example.com'
    });
    await ensureCliente({
        nombre: 'Distribuidora Escolar',
        numeroDocumento: '0614-555555-001-1',
        telefono: '2222-3333',
        correo: 'compras@distribuidoraescolar.com'
    });

    /* Usuarios demo */
    const roles = await query('SELECT RolID, Nombre FROM dbo.Rol');
    const rolPorNombre = new Map(roles.recordset.map((r) => [r.Nombre, r.RolID]));

    const admin = await ensureUsuario({
        nombre: 'Administrador General',
        correo: 'admin@inventario.local',
        password: 'Admin123!'
    }, rolPorNombre.get('Administrador'), null);

    await ensureUsuario({
        nombre: 'Gerente de Operaciones',
        correo: 'gerente@inventario.local',
        password: 'Demo123!'
    }, rolPorNombre.get('Gerente'), null);

    const encargadoInventario = await ensureUsuario({
        nombre: 'Encargado de Inventario',
        correo: 'inventario@inventario.local',
        password: 'Demo123!'
    }, rolPorNombre.get('Encargado de inventario'), central);

    await ensureUsuario({
        nombre: 'Encargado de Sucursal Santa Tecla',
        correo: 'sucursal@inventario.local',
        password: 'Demo123!'
    }, rolPorNombre.get('Encargado de sucursal'), santaTecla);

    const vendedor = await ensureUsuario({
        nombre: 'Vendedor de Mostrador',
        correo: 'vendedor@inventario.local',
        password: 'Demo123!'
    }, rolPorNombre.get('Vendedor'), central);

    /* Inventario inicial */
    const stockInicial = {
        'LAP-001': { [central]: 10, [santaTecla]: 4, [guatemala]: 6, [sanPedro]: 2 },
        'LAP-002': { [central]: 8, [santaTecla]: 3, [guatemala]: 5 },
        'MON-001': { [central]: 15, [santaTecla]: 6, [guatemala]: 8, [sanPedro]: 4 },
        'MON-002': { [central]: 9, [santaTecla]: 3, [guatemala]: 5 },
        'PER-001': { [central]: 40, [santaTecla]: 15, [guatemala]: 20, [sanPedro]: 10 },
        'PER-002': { [central]: 35, [santaTecla]: 12, [guatemala]: 18, [sanPedro]: 8 },
        'ALM-001': { [central]: 20, [santaTecla]: 8, [guatemala]: 10, [sanPedro]: 5 },
        'ALM-002': { [central]: 14, [santaTecla]: 5, [guatemala]: 7, [sanPedro]: 3 },
        'RED-001': { [central]: 12, [santaTecla]: 4, [guatemala]: 6, [sanPedro]: 2 },
        'RED-002': { [central]: 7, [santaTecla]: 2, [guatemala]: 3, [sanPedro]: 1 }
    };

    for (const [codigo, sucursales] of Object.entries(stockInicial)) {
        for (const [sucursalId, cantidad] of Object.entries(sucursales)) {
            await ensureInventario(productosCreados[codigo], Number(sucursalId), cantidad);
        }
    }

    /* Operaciones de demostración */
    await crearCompraDemo({
        proveedorId: proveedorTecno,
        sucursalId: central,
        usuarioId: admin,
        numeroFactura: 'FAC-DEMO-001',
        items: [
            { productoId: productosCreados['LAP-001'], cantidad: 2, costoUnitario: 700.00 },
            { productoId: productosCreados['MON-001'], cantidad: 3, costoUnitario: 150.00 }
        ]
    });

    await crearVentaDemo({
        sucursalId: central,
        clienteId: clienteMaria,
        usuarioId: vendedor,
        numeroComprobante: 'VENTA-DEMO-001',
        items: [
            { productoId: productosCreados['LAP-001'], cantidad: 1, precioUnitario: 850.00 },
            { productoId: productosCreados['PER-002'], cantidad: 2, precioUnitario: 12.00 }
        ]
    });

    await crearTransferenciaDemo({
        origenId: central,
        destinoId: santaTecla,
        usuarioId: encargadoInventario,
        codigo: 'TRF-DEMO-001',
        items: [
            { productoId: productosCreados['MON-001'], cantidad: 2 }
        ]
    });

    console.log('\nDatos de demostración creados correctamente.');
    console.log('\nCredenciales de acceso:');
    console.log('  Administrador          admin@inventario.local       / Admin123!');
    console.log('  Gerente                gerente@inventario.local     / Demo123!');
    console.log('  Encargado de inventario inventario@inventario.local / Demo123!');
    console.log('  Encargado de sucursal   sucursal@inventario.local   / Demo123!');
    console.log('  Vendedor               vendedor@inventario.local   / Demo123!');
}

main()
    .catch((error) => {
        console.error('Error al sembrar los datos:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closePool();
    });
