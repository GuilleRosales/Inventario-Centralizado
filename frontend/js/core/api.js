const TOKEN_KEY = 'inventario.token';
const USER_KEY = 'inventario.usuario';
const SUCURSAL_KEY = 'inventario.sucursal';

export class ApiError extends Error {
    constructor(message, status = 0, details = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
    }
}

/**
 * Cliente HTTP de la API. Encapsula el token, la sucursal activa,
 * la serialización y el manejo uniforme de errores.
 */
export class ApiClient {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
    }

    getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    getUser() {
        const raw = localStorage.getItem(USER_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }

    setSession(token, usuario) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    }

    clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    getSucursalId() {
        const raw = localStorage.getItem(SUCURSAL_KEY);
        if (raw === null || raw === '') return null;
        const value = Number(raw);
        return Number.isInteger(value) && value > 0 ? value : null;
    }

    setSucursalId(value) {
        if (value === null || value === undefined || value === '') {
            localStorage.removeItem(SUCURSAL_KEY);
        } else {
            localStorage.setItem(SUCURSAL_KEY, String(value));
        }
    }

    #buildQuery(params) {
        if (!params) return '';
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === '') continue;
            search.set(key, value);
        }
        const text = search.toString();
        return text ? `?${text}` : '';
    }

    async request(path, { method = 'GET', body, params } = {}) {
        const headers = {};
        const token = this.getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        if (body !== undefined) headers['Content-Type'] = 'application/json';

        let response;
        try {
            response = await fetch(`${this.baseUrl}${path}${this.#buildQuery(params)}`, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body)
            });
        } catch (_) {
            throw new ApiError(
                'No se pudo conectar con el servidor. Verifique que el backend esté en ejecución.',
                0
            );
        }

        const raw = await response.text();
        let data = null;
        if (raw) {
            try {
                data = JSON.parse(raw);
            } catch (_) {
                data = { error: raw };
            }
        }

        if (response.status === 401) {
            this.clearSession();
            if (!location.pathname.endsWith('index.html') && location.pathname !== '/') {
                location.href = '/';
            }
        }

        if (!response.ok) {
            throw new ApiError(
                data?.error || `Error HTTP ${response.status}`,
                response.status,
                data?.details || null
            );
        }

        return data;
    }

    get(path, params) {
        return this.request(path, { params });
    }

    post(path, body) {
        return this.request(path, { method: 'POST', body });
    }

    put(path, body) {
        return this.request(path, { method: 'PUT', body });
    }

    delete(path) {
        return this.request(path, { method: 'DELETE' });
    }
}

/** Instancia compartida por todas las páginas. */
export const api = new ApiClient();
