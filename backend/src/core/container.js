const { config } = require('./config');
const { Database } = require('./Database');
const { PasswordHasher } = require('./PasswordHasher');
const { TokenService } = require('./TokenService');
const { AuthService } = require('./AuthService');
const { AuthGuard } = require('./AuthGuard');

/**
 * Contenedor simple de dependencias compartidas.
 * Evita crear múltiples pools, servicios o instancias de autenticación.
 */
const database = new Database(config.db);
const passwordHasher = new PasswordHasher();
const tokenService = new TokenService(config.auth.secret, config.auth.tokenHours);
const authService = new AuthService(database, passwordHasher, tokenService);
const authGuard = new AuthGuard(authService);

module.exports = {
    config,
    database,
    passwordHasher,
    tokenService,
    authService,
    authGuard
};
