import { api } from './api.js';
import { el, clear, loading, initials, toast } from './ui.js';

import { PanelPage } from '../modules/panel/index.js';
import { InventarioPage } from '../modules/inventario/index.js';
import { MovimientosPage } from '../modules/movimientos/index.js';
import { ComprasPage } from '../modules/compras/index.js';
import { VentasPage } from '../modules/ventas/index.js';
import { TransferenciasPage } from '../modules/transferencias/index.js';
import { ProductosPage } from '../modules/productos/index.js';
import { CategoriasPage } from '../modules/categorias/index.js';
import { UbicacionesPage } from '../modules/ubicaciones/index.js';
import { UsuariosPage } from '../modules/usuarios/index.js';
import { ReportesPage } from '../modules/reportes/index.js';

/**
 * Shell de la aplicación: sesión, navegación, sucursal activa y montaje de páginas.
 */
export class App {
    static ICON_PATHS = {
        panel: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',
        inventario: '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
        movimientos: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
        compras: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.8a1 1 0 0 0 1-.8L21 8H6"/>',
        ventas: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
        transferencias: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
        productos: '<path d="M20 12 12 4H4v8l8 8 8-8Z"/><circle cx="8" cy="8" r="1"/>',
        categorias: '<path d="M3 6h7l2 3h9v11H3V6Z"/>',
        ubicaciones: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
        usuarios: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.6M18 20a5 5 0 0 0-3-4.6"/>',
        reportes: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
    };

    static ROUTES = [
        {
            id: 'panel', group: 'Principal', title: 'Panel de control',
            subtitle: 'Resumen general del inventario', icon: 'panel',
            permits: ['INVENTARIO.CONSULTAR'], Page: PanelPage
        },
        {
            id: 'inventario', group: 'Inventario', title: 'Existencias',
            subtitle: 'Stock por producto y sucursal', icon: 'inventario',
            permits: ['INVENTARIO.CONSULTAR'], Page: InventarioPage
        },
        {
            id: 'movimientos', group: 'Inventario', title: 'Movimientos',
            subtitle: 'Historial trazable de entradas y salidas', icon: 'movimientos',
            permits: ['MOVIMIENTOS.CONSULTAR'], Page: MovimientosPage
        },
        {
            id: 'compras', group: 'Operaciones', title: 'Compras',
            subtitle: 'Registro y recepción de compras a proveedores', icon: 'compras',
            permits: ['COMPRAS.CONSULTAR', 'COMPRAS.REGISTRAR'], Page: ComprasPage
        },
        {
            id: 'ventas', group: 'Operaciones', title: 'Ventas',
            subtitle: 'Registro y confirmación de ventas', icon: 'ventas',
            permits: ['VENTAS.CONSULTAR', 'VENTAS.REGISTRAR'], Page: VentasPage
        },
        {
            id: 'transferencias', group: 'Operaciones', title: 'Transferencias',
            subtitle: 'Movimiento de productos entre sucursales', icon: 'transferencias',
            permits: ['TRANSFERENCIAS.CONSULTAR', 'TRANSFERENCIAS.GESTIONAR'], Page: TransferenciasPage
        },
        {
            id: 'productos', group: 'Catálogo', title: 'Productos',
            subtitle: 'Catálogo centralizado de productos informáticos', icon: 'productos',
            permits: ['PRODUCTOS.CONSULTAR'], Page: ProductosPage
        },
        {
            id: 'categorias', group: 'Catálogo', title: 'Categorías',
            subtitle: 'Clasificación del catálogo de productos', icon: 'categorias',
            permits: ['PRODUCTOS.GESTIONAR'], Page: CategoriasPage
        },
        {
            id: 'ubicaciones', group: 'Administración', title: 'Ubicaciones y sucursales',
            subtitle: 'Países, divisiones territoriales, ciudades y sucursales', icon: 'ubicaciones',
            permits: ['UBICACIONES.GESTIONAR'], Page: UbicacionesPage
        },
        {
            id: 'usuarios', group: 'Administración', title: 'Usuarios y roles',
            subtitle: 'Accesos, roles, permisos y sucursales asignadas', icon: 'usuarios',
            permits: ['USUARIOS.GESTIONAR', 'ROLES.GESTIONAR'], Page: UsuariosPage
        },
        {
            id: 'reportes', group: 'Análisis', title: 'Reportes',
            subtitle: 'Información consolidada para la toma de decisiones', icon: 'reportes',
            permits: ['REPORTES.GENERAR'], Page: ReportesPage
        }
    ];

    static GROUPS = [
        'Principal', 'Inventario', 'Operaciones',
        'Catálogo', 'Administración', 'Análisis'
    ];

    constructor() {
        this.state = {
            user: null,
            sucursales: [],
            sucursalId: null,
            currentRoute: null
        };
        this.onHashChange = () => this.renderRoute();
    }

    icon(name) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round">${App.ICON_PATHS[name] || ''}</svg>`;
    }

    puedeAlguno(permisos) {
        const propios = this.state.user?.permisos || [];
        return permisos.some((permiso) => propios.includes(permiso));
    }

    rutasPermitidas() {
        return App.ROUTES.filter((route) => this.puedeAlguno(route.permits));
    }

    renderUser() {
        const user = this.state.user;
        const role = user.roles?.join(', ') || 'Usuario';
        const avatarText = initials(user.nombre);

        for (const id of ['user-name', 'top-name']) {
            const node = document.getElementById(id);
            if (node) node.textContent = user.nombre;
        }
        for (const id of ['user-role', 'top-role']) {
            const node = document.getElementById(id);
            if (node) node.textContent = role;
        }
        for (const id of ['user-avatar', 'top-avatar']) {
            const node = document.getElementById(id);
            if (node) node.textContent = avatarText;
        }
    }

    async initBranches() {
        let branches = this.state.user.sucursales || [];

        if (branches.length === 0) {
            const response = await api.get('/geografia/sucursales');
            branches = response.datos.map((sucursal) => ({
                SucursalID: sucursal.SucursalID,
                CodigoSucursal: sucursal.CodigoSucursal,
                Nombre: sucursal.Nombre,
                EsPrincipal: false
            }));
        }

        this.state.sucursales = branches;

        const selectNode = document.getElementById('branch-select');
        clear(selectNode);
        selectNode.appendChild(el('option', { value: '', text: 'Todas las sucursales' }));
        for (const branch of branches) {
            selectNode.appendChild(el('option', {
                value: branch.SucursalID,
                text: `${branch.CodigoSucursal} · ${branch.Nombre}`
            }));
        }

        let saved = api.getSucursalId();
        if (saved && !branches.some((branch) => branch.SucursalID === saved)) saved = null;
        if (!saved) {
            const principal = branches.find((branch) => branch.EsPrincipal);
            saved = principal
                ? principal.SucursalID
                : (branches.length === 1 ? branches[0].SucursalID : null);
        }
        api.setSucursalId(saved);
        selectNode.value = saved ?? '';
        this.state.sucursalId = saved;

        selectNode.addEventListener('change', () => {
            const value = selectNode.value ? Number(selectNode.value) : null;
            this.state.sucursalId = value;
            api.setSucursalId(value);
            this.renderRoute();
        });
    }

    renderNav() {
        const nav = document.getElementById('nav');
        clear(nav);

        const allowed = this.rutasPermitidas();

        for (const group of App.GROUPS) {
            const routes = allowed.filter((route) => route.group === group);
            if (routes.length === 0) continue;

            nav.appendChild(el('div', { class: 'nav-group-title', text: group }));
            for (const route of routes) {
                nav.appendChild(el('a', {
                    class: 'nav-link',
                    href: `#/${route.id}`,
                    dataset: { route: route.id },
                    html: `${this.icon(route.icon)}<span>${route.title}</span>`
                }));
            }
        }
    }

    currentRouteId() {
        const raw = location.hash.replace(/^#\/?/, '').trim();
        const allowed = this.rutasPermitidas();
        if (!raw) return allowed[0]?.id || 'panel';
        if (!allowed.some((route) => route.id === raw)) return allowed[0]?.id || 'panel';
        return raw;
    }

    buildContext() {
        return {
            user: this.state.user,
            sucursalId: this.state.sucursalId,
            sucursales: this.state.sucursales,
            puede: (permiso) => (this.state.user.permisos || []).includes(permiso),
            puedeAlguno: (permisos) => this.puedeAlguno(permisos),
            navigate: (path) => { location.hash = `#/${path}`; },
            refresh: () => this.renderRoute()
        };
    }

    renderError(content, error) {
        clear(content);
        content.appendChild(el('div', { class: 'card card-pad' },
            el('div', { class: 'info-banner danger' },
                el('div', {},
                    el('strong', { text: 'No se pudo cargar la página. ' }),
                    el('span', { text: error.message || 'Error inesperado.' })
                )
            ),
            el('div', { class: 'row', style: { marginTop: '14px' } },
                el('button', {
                    class: 'btn btn-primary', text: 'Reintentar',
                    on: { click: () => this.renderRoute() }
                })
            )
        ));
        toast(error.message || 'Error al cargar la página.', 'error');
    }

    async renderRoute() {
        if (!this.state.user) return;

        const routeId = this.currentRouteId();
        const route = App.ROUTES.find((item) => item.id === routeId);
        if (!route) return;

        this.state.currentRoute = route;

        document.querySelectorAll('.nav-link').forEach((link) => {
            link.classList.toggle('active', link.dataset.route === route.id);
        });

        document.getElementById('page-title').textContent = route.title;
        document.getElementById('page-subtitle').textContent = route.subtitle;
        document.title = `${route.title} · Inventario Centralizado`;

        const content = document.getElementById('content');
        clear(content);
        content.appendChild(loading());

        try {
            clear(content);
            const page = new route.Page(content, this.buildContext());
            await page.render();
        } catch (error) {
            this.renderError(content, error);
        }

        this.closeSidebar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    openSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('show');
    }

    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('show');
    }

    bindShell() {
        document.getElementById('logout-btn').addEventListener('click', () => {
            api.clearSession();
            location.href = '/';
        });

        document.getElementById('menu-btn').addEventListener('click', () => this.openSidebar());
        document.getElementById('sidebar-close').addEventListener('click', () => this.closeSidebar());
        document.getElementById('sidebar-overlay').addEventListener('click', () => this.closeSidebar());

        window.addEventListener('hashchange', this.onHashChange);
    }

    async boot() {
        if (!api.getToken()) {
            location.replace('/');
            return;
        }

        try {
            const data = await api.get('/auth/me');
            this.state.user = data.usuario;
        } catch (_) {
            api.clearSession();
            location.replace('/');
            return;
        }

        this.state.user.permisos = this.state.user.permisos || [];
        this.state.user.roles = this.state.user.roles || [];

        this.renderUser();
        await this.initBranches();
        this.renderNav();
        this.bindShell();

        if (!location.hash) {
            location.replace(`#/${this.rutasPermitidas()[0]?.id || 'panel'}`);
        } else {
            this.renderRoute();
        }
    }
}

new App().boot();
