const { conectar } = require('./database');

async function main() {
    const pool = await conectar();

    if (!pool) return;

    try {
        const resultado = await pool.request().query(`
            SELECT
                @@SERVERNAME AS Servidor,
                DB_NAME() AS BaseDatos,
                GETDATE() AS Fecha
        `);

        console.log(resultado.recordset);

    } catch (error) {
        console.error(error);

    } finally {
        pool.close();
    }
}

main();
