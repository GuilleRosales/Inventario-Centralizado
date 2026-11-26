/**
 * Base para los servicios de cada módulo.
 * Expone el acceso a datos sin acoplar los servicios a Express.
 */
class BaseService {
    constructor(database) {
        this.db = database;
    }

    query(text, params = {}) {
        return this.db.query(text, params);
    }

    queryTx(tx, text, params = {}) {
        return this.db.queryTx(tx, text, params);
    }

    execute(procedure, params = {}, outputs = {}) {
        return this.db.execute(procedure, params, outputs);
    }

    transaction(work) {
        return this.db.transaction(work);
    }
}

module.exports = { BaseService };
