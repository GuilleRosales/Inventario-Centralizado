const sql = require('mssql');

const config = {
    user:'sa',
    password:'TuContraseña123!',
    server:'localhost',
    port:1433,

    database: 'master',

    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function conectar() {
    try {
        const pool = await sql.connect(config);

        console.log('Conexión establecida con SQL Server');

        return pool;
    } catch (error) {
        console.error('Error de conexión: ', error);
    }
} 

module.exports = { conectar, sql };