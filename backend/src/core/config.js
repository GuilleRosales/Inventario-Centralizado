const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function bool(value, fallback) {
    if (value === undefined) return fallback;
    return String(value).toLowerCase() === 'true';
}

const config = {
    port: Number(process.env.PORT || 3000),
    db: {
        server: process.env.DB_SERVER || 'localhost',
        port: Number(process.env.DB_PORT || 1433),
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'InventarioCentralizado',
        options: {
            encrypt: bool(process.env.DB_ENCRYPT, false),
            trustServerCertificate: bool(process.env.DB_TRUST_SERVER_CERT, true)
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    },
    auth: {
        secret: process.env.AUTH_SECRET || 'cambiar-este-secreto-en-produccion',
        tokenHours: Number(process.env.AUTH_TOKEN_HOURS || 12)
    }
};

module.exports = { config };
