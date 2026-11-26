const sql = require('mssql');

/**
 * Encapsula el pool de conexiones y las operaciones contra SQL Server.
 * Los servicios reciben una instancia de esta clase por inyección.
 */
class Database {
    #poolPromise = null;

    constructor(databaseConfig) {
        this.config = databaseConfig;
    }

    async getPool() {
        if (!this.#poolPromise) {
            this.#poolPromise = new sql.ConnectionPool(this.config).connect().catch((error) => {
                this.#poolPromise = null;
                throw error;
            });
        }
        return this.#poolPromise;
    }

    #buildRequest(target, params = {}) {
        const request = target instanceof sql.Transaction
            ? new sql.Request(target)
            : target.request();

        for (const [name, raw] of Object.entries(params)) {
            if (raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'type')) {
                request.input(name, raw.type, raw.value);
            } else {
                request.input(name, raw);
            }
        }
        return request;
    }

    async query(text, params = {}) {
        const pool = await this.getPool();
        return this.#buildRequest(pool, params).query(text);
    }

    /** Ejecuta una consulta dentro de una transacción ya abierta. */
    async queryTx(tx, text, params = {}) {
        return this.#buildRequest(tx, params).query(text);
    }

    async execute(procedure, params = {}, outputs = {}) {
        const pool = await this.getPool();
        const request = this.#buildRequest(pool, params);
        for (const [name, type] of Object.entries(outputs)) {
            request.output(name, type);
        }
        return request.execute(procedure);
    }

    async transaction(work) {
        const pool = await this.getPool();
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const result = await work(tx);
            await tx.commit();
            return result;
        } catch (error) {
            try {
                await tx.rollback();
            } catch (_) {
                /* la transacción ya pudo haber sido revertida */
            }
            throw error;
        }
    }

    async close() {
        if (this.#poolPromise) {
            const pool = await this.#poolPromise;
            await pool.close();
            this.#poolPromise = null;
        }
    }
}

module.exports = { Database, sql };
