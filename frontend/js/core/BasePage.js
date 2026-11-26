/**
 * Clase base de las páginas del frontend.
 * Centraliza el acceso al contenedor, al contexto de sesión y a los permisos.
 */
export class BasePage {
    constructor(container, ctx = {}) {
        this.container = container;
        this.ctx = ctx;
        this.user = ctx.user || {};
        this.sucursalId = ctx.sucursalId ?? null;
        this.sucursales = ctx.sucursales || [];
    }

    /** Verifica un permiso del usuario actual. */
    puede(permiso) {
        if (typeof this.ctx.puede === 'function') return this.ctx.puede(permiso);
        return (this.user.permisos || []).includes(permiso);
    }

    /** Verifica si el usuario tiene al menos uno de los permisos indicados. */
    puedeAlguno(permisos) {
        if (typeof this.ctx.puedeAlguno === 'function') return this.ctx.puedeAlguno(permisos);
        return permisos.some((permiso) => this.puede(permiso));
    }

    /** Navega a otra sección del sistema. */
    navigate(path) {
        if (typeof this.ctx.navigate === 'function') {
            this.ctx.navigate(path);
        } else {
            location.hash = `#/${path}`;
        }
    }

    /** Vuelve a montar la página actual. */
    refresh() {
        return this.ctx.refresh?.();
    }

    /** Cada página concreta implementa su propio render. */
    async render() {
        throw new Error('La página debe implementar el método render().');
    }
}
