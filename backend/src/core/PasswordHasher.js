const crypto = require('crypto');

/**
 * Genera y verifica hashes de contraseña con scrypt.
 */
class PasswordHasher {
    constructor({ N = 16384, r = 8, p = 1, keyLength = 64 } = {}) {
        this.N = N;
        this.r = r;
        this.p = p;
        this.keyLength = keyLength;
    }

    hash(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto
            .scryptSync(password, salt, this.keyLength, { N: this.N, r: this.r, p: this.p })
            .toString('hex');
        return `scrypt$${this.N}$${this.r}$${this.p}$${salt}$${hash}`;
    }

    verify(password, stored) {
        try {
            const [algorithm, n, r, p, salt, hash] = String(stored || '').split('$');
            if (algorithm !== 'scrypt' || !salt || !hash) return false;
            const derived = crypto.scryptSync(password, salt, hash.length / 2, {
                N: Number(n),
                r: Number(r),
                p: Number(p)
            });
            const expected = Buffer.from(hash, 'hex');
            return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
        } catch (_) {
            return false;
        }
    }
}

module.exports = { PasswordHasher };
