const path = require('path');
const express = require('express');
const { config, database, authGuard } = require('./core/container');
const { Validator } = require('./core/Validator');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

/* Rutas públicas */
app.get('/api/health', (req, res) => {
    res.json({ estado: 'ok', fecha: new Date().toISOString() });
});
app.use('/api/auth', require('./modules/auth/routes'));

/* A partir de aquí todo requiere sesión */
app.use('/api', authGuard.authenticate());
app.use('/api/dashboard', require('./modules/dashboard/routes'));
app.use('/api/geografia', require('./modules/geografia/routes'));
app.use('/api/catalogos', require('./modules/catalogos/routes'));
app.use('/api', require('./modules/usuarios/routes'));
app.use('/api/inventario', require('./modules/inventario/routes'));
app.use('/api/compras', require('./modules/compras/routes'));
app.use('/api/ventas', require('./modules/ventas/routes'));
app.use('/api/transferencias', require('./modules/transferencias/routes'));
app.use('/api/movimientos', require('./modules/movimientos/routes'));
app.use('/api/reportes', require('./modules/reportes/routes'));

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
});

/* Archivos estáticos del frontend */
const frontendDir = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendDir));
app.get('/app', (req, res) => {
    res.sendFile(path.join(frontendDir, 'app.html'));
});

/* Manejo centralizado de errores */
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const sqlMessage = Validator.sqlErrorMessage(error);
    const status = sqlMessage ? 400 : (error.status || 500);
    const message = sqlMessage || error.message || 'Error interno del servidor.';

    if (status >= 500) {
        console.error(`[${new Date().toISOString()}]`, error);
    }

    res.status(status).json({ error: message });
});

async function start() {
    try {
        await database.getPool();
        console.log('Conexión establecida con SQL Server.');
        app.listen(config.port, () => {
            console.log(`Servidor disponible en http://localhost:${config.port}`);
        });
    } catch (error) {
        console.error('No se pudo conectar con SQL Server:', error.message);
        process.exit(1);
    }
}

async function shutdown() {
    try {
        await database.close();
    } finally {
        process.exit(0);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
