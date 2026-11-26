const crypto = require('crypto');

/**
 * Firma y verifica tokens HMAC-SHA256 compatibles con JWT.
 */
class TokenService {
    constructor(secret, tokenHours = 12) {
        this.secret = secret;
        this.tokenHours = tokenHours;
    }

    sign(payload) {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const now = Math.floor(Date.now() / 1000);
        const body = Buffer.from(JSON.stringify({
            ...payload,
            iat: now,
            exp: now + this.tokenHours * 3600
        })).toString('base64url');
        const signature = crypto
            .createHmac('sha256', this.secret)
            .update(`${header}.${body}`)
            .digest('base64url');
        return `${header}.${body}.${signature}`;
    }

    verify(token) {
        const parts = String(token || '').split('.');
        if (parts.length !== 3) return null;

        const [header, body, signature] = parts;
        const expected = crypto
            .createHmac('sha256', this.secret)
            .update(`${header}.${body}`)
            .digest('base64url');

        if (signature.length !== expected.length) return null;
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

        try {
            const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
            if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
            return payload;
        } catch (_) {
            return null;
        }
    }
}

module.exports = { TokenService };
