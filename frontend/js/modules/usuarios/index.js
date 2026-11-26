import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, tabs, field, input, textarea, select,
    formatDate, badge, emptyState, loading, openModal, toast
} from '../../core/ui.js';

function grupoPermiso(codigo) {
    const prefijo = String(codigo).split('.')[0];
    const nombres = {
        INVENTARIO: 'Inventario',
        MOVIMIENTOS: 'Movimientos',
        COMPRAS: 'Compras',
        VENTAS: 'Ventas',
        TRANSFERENCIAS: 'Transferencias',
        PRODUCTOS: 'Productos',
        UBICACIONES: 'Ubicaciones',
        USUARIOS: 'Usuarios',
        ROLES: 'Roles',
        REPORTES: 'Reportes'
    };
    return nombres[prefijo] || prefijo;
}

function iconoRol(rol) {
    return el('span', { class: 'badge badge-info', text: rol.Nombre });
}

export class UsuariosPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando usuarios y roles…'));

        let usuarios = [];
        let roles = [];
        let permisos = [];

        const puedeUsuarios = ctx.puede('USUARIOS.GESTIONAR');
        const puedeRoles = ctx.puede('ROLES.GESTIONAR');
        const puedeSucursales = ctx.puede('UBICACIONES.GESTIONAR');

        async function cargarTodo() {
            const [rolesResponse, permisosResponse, usuariosResponse] = await Promise.all([
                api.get('/roles'),
                puedeRoles ? api.get('/permisos') : Promise.resolve({ datos: [] }),
                puedeUsuarios ? api.get('/usuarios') : Promise.resolve({ datos: [] })
            ]);
            usuarios = usuariosResponse.datos;
            roles = rolesResponse.datos;
            permisos = permisosResponse.datos;
        }

        await cargarTodo();
        clear(container);

        const root = el('div');
        container.appendChild(root);

        let activeTab = puedeUsuarios ? 'usuarios' : 'roles';

        function renderPagina() {
            clear(root);

            const acciones = [];
            if (activeTab === 'usuarios' && puedeUsuarios) {
                acciones.push(el('button', {
                    class: 'btn btn-primary', text: '+ Nuevo usuario',
                    on: { click: () => formularioUsuario() }
                }));
            } else if (activeTab === 'roles' && puedeRoles) {
                acciones.push(el('button', {
                    class: 'btn btn-primary', text: '+ Nuevo rol',
                    on: { click: () => formularioRol() }
                }));
            }

            root.appendChild(pageHead(
                'Usuarios y roles',
                'Administre accesos, roles, permisos y sucursales asignadas.',
                acciones
            ));

            const pestañas = [];
            if (puedeUsuarios) {
                pestañas.push({ key: 'usuarios', label: `Usuarios (${usuarios.length})` });
            }
            if (puedeRoles) {
                pestañas.push({ key: 'roles', label: `Roles (${roles.length})` });
            }

            root.appendChild(tabs(pestañas, activeTab, (key) => {
                activeTab = key;
                renderPagina();
            }));

            root.appendChild(activeTab === 'usuarios' ? tablaUsuarios() : tablaRoles());
        }

        /* ------------------------------- USUARIOS ------------------------------- */

        function tablaUsuarios() {
            const tbody = el('tbody');

            if (usuarios.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 6 }, emptyState(
                    'Sin usuarios', 'Cree el primer usuario del sistema.'
                ))));
            }

            for (const usuario of usuarios) {
                const acciones = [
                    el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Editar',
                        on: { click: () => formularioUsuario(usuario) }
                    }),
                    el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Roles',
                        on: { click: () => modalRoles(usuario) }
                    })
                ];

                if (puedeSucursales) {
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Sucursales',
                        on: { click: () => modalSucursales(usuario) }
                    }));
                }

                tbody.appendChild(el('tr', {},
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('strong', { text: usuario.Nombre }),
                            el('small', { text: usuario.Correo })
                        )
                    ),
                    el('td', {},
                        el('div', { class: 'pill-row' },
                            ...(usuario.roles.length
                                ? usuario.roles.map(iconoRol)
                                : [badge('Sin rol', 'neutral')])
                        )
                    ),
                    el('td', {},
                        el('div', { class: 'pill-row' },
                            ...(usuario.sucursales.length
                                ? usuario.sucursales.map((sucursal) => el('span', {
                                    class: `badge ${sucursal.EsPrincipal ? 'badge-success' : 'badge-neutral'}`,
                                    text: sucursal.CodigoSucursal
                                }))
                                : [el('span', { class: 'muted small', text: 'Todas' })])
                        )
                    ),
                    el('td', { class: 'muted small', text: formatDate(usuario.FechaCreacion) }),
                    el('td', {}, usuario.Activo ? badge('Activo', 'success') : badge('Inactivo', 'danger')),
                    el('td', {}, el('div', { class: 'actions-cell' }, ...acciones))
                ));
            }

            return el('section', { class: 'card' },
                el('div', { class: 'table-wrap' },
                    el('table', { class: 'data' },
                        el('thead', {}, el('tr', {},
                            el('th', { text: 'Usuario' }),
                            el('th', { text: 'Roles' }),
                            el('th', { text: 'Sucursales' }),
                            el('th', { text: 'Creado' }),
                            el('th', { text: 'Estado' }),
                            el('th', { class: 'text-right', text: 'Acciones' })
                        )),
                        tbody
                    )
                )
            );
        }

        function formularioUsuario(usuario = null) {
            const rolesActivos = roles.filter((rol) => rol.Activo);
            if (!usuario && rolesActivos.length === 0) {
                toast('Primero debe existir al menos un rol activo.', 'warning');
                return;
            }

            const esNuevo = !usuario;
            const rolSelect = esNuevo ? select('rolId', rolesActivos.map((rol) => ({
                value: rol.RolID, label: rol.Nombre
            })), { required: true }) : null;

            const sucursalSelect = esNuevo ? select('sucursalId', [
                { value: '', label: 'Sin sucursal asignada' },
                ...ctx.sucursales.map((s) => ({
                    value: s.SucursalID,
                    label: `${s.CodigoSucursal} · ${s.Nombre}`
                }))
            ]) : null;

            openModal({
                title: esNuevo ? 'Nuevo usuario' : 'Editar usuario',
                subtitle: esNuevo
                    ? 'El usuario podrá acceder con el correo y la contraseña definidos.'
                    : `${usuario.Correo} · ${usuario.roles.map((rol) => rol.Nombre).join(', ')}`,
                body: el('div', { class: 'form-grid' },
                    field('Nombre completo', input('nombre', {
                        required: true, maxlength: 150, value: usuario?.Nombre || ''
                    })),
                    field('Correo electrónico', input('correo', {
                        type: 'email', required: true, maxlength: 150,
                        value: usuario?.Correo || ''
                    })),
                    field(esNuevo ? 'Contraseña' : 'Nueva contraseña (opcional)', input('password', {
                        type: 'password',
                        required: esNuevo,
                        minlength: 6,
                        placeholder: esNuevo ? 'Mínimo 6 caracteres' : 'Dejar vacío para conservar'
                    }), 'Debe tener al menos 6 caracteres.'),
                    esNuevo
                        ? field('Rol inicial', rolSelect)
                        : el('label', { class: 'checkbox' },
                            el('input', {
                                type: 'checkbox', name: 'activo', checked: Boolean(usuario.Activo)
                            }),
                            'Usuario activo'
                        ),
                    esNuevo ? el('div', { class: 'span-2' }, field('Sucursal principal', sucursalSelect)) : null
                ),
                submitLabel: esNuevo ? 'Crear usuario' : 'Guardar cambios',
                onSubmit: async (data) => {
                    if (esNuevo) {
                        await api.post('/usuarios', {
                            nombre: data.nombre,
                            correo: data.correo,
                            password: data.password,
                            rolId: data.rolId,
                            sucursalId: data.sucursalId || null
                        });
                        toast('Usuario creado.', 'success');
                    } else {
                        await api.put(`/usuarios/${usuario.UsuarioID}`, {
                            nombre: data.nombre,
                            correo: data.correo,
                            activo: data.activo === 'on',
                            password: data.password || ''
                        });
                        toast('Usuario actualizado.', 'success');
                    }
                    await recargar();
                }
            });
        }

        function modalRoles(usuario) {
            const actuales = new Set(usuario.roles.map((rol) => Number(rol.RolID)));
            const checkboxes = new Map();

            const cuerpo = el('div', { class: 'stack' },
                el('div', { class: 'info-banner' },
                    el('span', { text: 'Un usuario debe conservar al menos un rol activo.' })
                ),
                el('div', { class: 'stack' },
                    ...roles
                        .filter((rol) => rol.Activo || actuales.has(Number(rol.RolID)))
                        .map((rol) => {
                            const checkbox = el('input', {
                                type: 'checkbox',
                                checked: actuales.has(Number(rol.RolID))
                            });
                            checkboxes.set(Number(rol.RolID), checkbox);
                            return el('label', { class: 'checkbox' },
                                checkbox,
                                el('div', {},
                                    el('strong', {
                                        text: `${rol.Nombre}${rol.Activo ? '' : ' (inactivo)'}`
                                    }),
                                    el('div', { class: 'muted small', text: rol.Descripcion || '' })
                                )
                            );
                        })
                )
            );

            openModal({
                title: 'Roles del usuario',
                subtitle: usuario.Nombre,
                body: cuerpo,
                submitLabel: 'Guardar roles',
                onSubmit: async () => {
                    const seleccionados = [...checkboxes.entries()]
                        .filter(([, checkbox]) => checkbox.checked)
                        .map(([rolId]) => rolId);

                    if (seleccionados.length === 0) {
                        throw new Error('Debe asignar al menos un rol.');
                    }

                    const agregar = seleccionados.filter((rolId) => !actuales.has(rolId));
                    const quitar = [...actuales].filter((rolId) => !seleccionados.includes(rolId));

                    for (const rolId of agregar) {
                        await api.post(`/usuarios/${usuario.UsuarioID}/roles`, { rolId });
                    }
                    for (const rolId of quitar) {
                        await api.delete(`/usuarios/${usuario.UsuarioID}/roles/${rolId}`);
                    }

                    toast('Roles actualizados.', 'success');
                    await recargar();
                }
            });
        }

        function modalSucursales(usuario) {
            const actuales = new Map(
                usuario.sucursales.map((sucursal) => [Number(sucursal.SucursalID), sucursal])
            );

            const filas = new Map();

            const cuerpo = el('div', { class: 'table-wrap' },
                el('table', { class: 'data' },
                    el('thead', {}, el('tr', {},
                        el('th', { text: 'Asignada' }),
                        el('th', { text: 'Sucursal' }),
                        el('th', { text: 'Principal' })
                    )),
                    el('tbody', {},
                        ...ctx.sucursales.map((sucursal) => {
                            const actual = actuales.get(Number(sucursal.SucursalID));
                            const asignada = el('input', {
                                type: 'checkbox', checked: Boolean(actual)
                            });
                            const principal = el('input', {
                                type: 'radio', name: 'principal',
                                value: sucursal.SucursalID,
                                checked: Boolean(actual?.EsPrincipal),
                                disabled: !actual
                            });

                            asignada.addEventListener('change', () => {
                                principal.disabled = !asignada.checked;
                                if (!asignada.checked) principal.checked = false;
                                if (asignada.checked) principal.checked = true;
                            });

                            filas.set(Number(sucursal.SucursalID), { asignada, principal, actual });

                            return el('tr', {},
                                el('td', {}, asignada),
                                el('td', {},
                                    el('div', { class: 'product-cell' },
                                        el('strong', { text: sucursal.Nombre }),
                                        el('small', { text: sucursal.CodigoSucursal })
                                    )
                                ),
                                el('td', {}, principal)
                            );
                        })
                    )
                )
            );

            openModal({
                title: 'Sucursales del usuario',
                subtitle: usuario.Nombre,
                body: el('div', { class: 'stack' },
                    el('div', { class: 'info-banner' },
                        el('span', { text: 'Marque las sucursales a las que puede acceder y cuál será la principal.' })
                    ),
                    cuerpo
                ),
                submitLabel: 'Guardar sucursales',
                onSubmit: async () => {
                    for (const [sucursalId, { asignada, principal, actual }] of filas.entries()) {
                        if (asignada.checked) {
                            const esPrincipal = principal.checked;
                            if (!actual || Boolean(actual.EsPrincipal) !== esPrincipal) {
                                await api.post(`/usuarios/${usuario.UsuarioID}/sucursales`, {
                                    sucursalId,
                                    esPrincipal
                                });
                            }
                        } else if (actual) {
                            await api.delete(`/usuarios/${usuario.UsuarioID}/sucursales/${sucursalId}`);
                        }
                    }
                    toast('Sucursales actualizadas.', 'success');
                    await recargar();
                }
            });
        }

        /* --------------------------------- ROLES -------------------------------- */

        function tablaRoles() {
            const tbody = el('tbody');
            const grupos = [...new Set(permisos.map((permiso) => grupoPermiso(permiso.Codigo)))];

            if (roles.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 5 }, emptyState(
                    'Sin roles', 'Cree el primer rol del sistema.'
                ))));
            }

            for (const rol of roles) {
                const acciones = [];

                if (puedeRoles) {
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Editar',
                        on: { click: () => formularioRol(rol) }
                    }));
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Permisos',
                        on: { click: () => modalPermisos(rol, grupos) }
                    }));
                }

                tbody.appendChild(el('tr', {},
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('strong', { text: rol.Nombre }),
                            el('small', { text: rol.Descripcion || '—' })
                        )
                    ),
                    el('td', { class: 'num', text: rol.permisos.length }),
                    el('td', {},
                        el('div', { class: 'pill-row' },
                            ...(rol.permisos.length
                                ? rol.permisos.slice(0, 3).map((permiso) => el('span', {
                                    class: 'badge badge-neutral', text: permiso.Codigo
                                }))
                                : [el('span', { class: 'muted small', text: 'Sin permisos' })]),
                            rol.permisos.length > 3
                                ? el('span', { class: 'muted small', text: `+${rol.permisos.length - 3}` })
                                : null
                        )
                    ),
                    el('td', {}, rol.Activo ? badge('Activo', 'success') : badge('Inactivo', 'danger')),
                    el('td', {},
                        el('div', { class: 'actions-cell' },
                            ...(acciones.length ? acciones : [el('span', { class: 'muted small', text: 'Solo lectura' })])
                        )
                    )
                ));
            }

            return el('section', { class: 'card' },
                el('div', { class: 'table-wrap' },
                    el('table', { class: 'data' },
                        el('thead', {}, el('tr', {},
                            el('th', { text: 'Rol' }),
                            el('th', { class: 'num', text: 'Permisos' }),
                            el('th', { text: 'Permisos asignados' }),
                            el('th', { text: 'Estado' }),
                            el('th', { class: 'text-right', text: 'Acciones' })
                        )),
                        tbody
                    )
                )
            );
        }

        function formularioRol(rol = null) {
            openModal({
                title: rol ? 'Editar rol' : 'Nuevo rol',
                subtitle: rol ? rol.Nombre : 'Defina un nuevo perfil de acceso.',
                body: el('div', { class: 'form-grid' },
                    field('Nombre del rol', input('nombre', {
                        required: true, maxlength: 80, value: rol?.Nombre || ''
                    })),
                    rol ? el('label', { class: 'checkbox' },
                        el('input', { type: 'checkbox', name: 'activo', checked: Boolean(rol.Activo) }),
                        'Rol activo'
                    ) : null,
                    el('div', { class: 'span-2' },
                        field('Descripción', textarea('descripcion', {
                            maxlength: 250, rows: 2, value: rol?.Descripcion || ''
                        }))
                    )
                ),
                submitLabel: rol ? 'Guardar cambios' : 'Crear rol',
                onSubmit: async (data) => {
                    if (rol) {
                        await api.put(`/roles/${rol.RolID}`, {
                            nombre: data.nombre,
                            descripcion: data.descripcion,
                            activo: data.activo === 'on'
                        });
                        toast('Rol actualizado.', 'success');
                    } else {
                        await api.post('/roles', {
                            nombre: data.nombre,
                            descripcion: data.descripcion
                        });
                        toast('Rol creado.', 'success');
                    }
                    await recargar();
                }
            });
        }

        function modalPermisos(rol, grupos) {
            const asignados = new Set(rol.permisos.map((permiso) => Number(permiso.PermisoID)));
            const checkboxes = new Map();

            const cuerpo = el('div', { class: 'stack' },
                ...grupos.map((grupo) => {
                    const items = permisos.filter((permiso) => grupoPermiso(permiso.Codigo) === grupo);
                    return el('div', { class: 'card card-pad', style: { padding: '14px 16px' } },
                        el('div', { class: 'form-section-title', style: { marginTop: '0' }, text: grupo }),
                        el('div', { class: 'stack', style: { gap: '8px', marginTop: '8px' } },
                            ...items.map((permiso) => {
                                const checkbox = el('input', {
                                    type: 'checkbox',
                                    checked: asignados.has(Number(permiso.PermisoID))
                                });
                                checkboxes.set(Number(permiso.PermisoID), checkbox);
                                return el('label', { class: 'checkbox' },
                                    checkbox,
                                    el('div', {},
                                        el('strong', { text: permiso.Codigo }),
                                        el('div', { class: 'muted small', text: permiso.Descripcion || '' })
                                    )
                                );
                            })
                        )
                    );
                })
            );

            openModal({
                title: 'Permisos del rol',
                subtitle: rol.Nombre,
                size: 'modal-lg',
                body: cuerpo,
                submitLabel: 'Guardar permisos',
                onSubmit: async () => {
                    const seleccionados = [...checkboxes.entries()]
                        .filter(([, checkbox]) => checkbox.checked)
                        .map(([permisoId]) => permisoId);

                    await api.put(`/roles/${rol.RolID}/permisos`, { permisos: seleccionados });
                    toast('Permisos actualizados. Los usuarios deberán iniciar sesión nuevamente.', 'success');
                    await recargar();
                }
            });
        }

        async function recargar() {
            try {
                await cargarTodo();
            } finally {
                renderPagina();
            }
        }

        renderPagina();
    }
}
