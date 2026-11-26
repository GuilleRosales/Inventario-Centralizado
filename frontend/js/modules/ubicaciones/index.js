import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, card, tabs, field, input, select,
    badge, emptyState, loading, openModal, toast, confirmDialog
} from '../../core/ui.js';

const TIPOS_DIVISION = ['Departamento', 'Estado', 'Provincia', 'Región'];

export class UbicacionesPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando estructura geográfica…'));

        let paises = [];
        let divisiones = [];
        let ciudades = [];
        let sucursales = [];
        let activeTab = 'sucursales';

        const root = el('div');
        container.appendChild(root);

        async function cargar() {
            const [p, d, c, s] = await Promise.all([
                api.get('/geografia/paises', { incluirInactivos: 1 }),
                api.get('/geografia/divisiones', { incluirInactivas: 1 }),
                api.get('/geografia/ciudades', { incluirInactivas: 1 }),
                api.get('/geografia/sucursales', { incluirInactivas: 1 })
            ]);
            paises = p.datos;
            divisiones = d.datos;
            ciudades = c.datos;
            sucursales = s.datos;
        }

        function paisNombre(id) {
            return paises.find((p) => p.PaisID === id)?.Nombre || '—';
        }

        function opcionesPaises(selected = '') {
            return [
                { value: '', label: 'Seleccione un país' },
                ...paises.map((p) => ({ value: p.PaisID, label: p.Nombre, selected: Number(selected) === p.PaisID }))
            ];
        }

        function opcionesDivisiones(paisId, selected = '') {
            const items = divisiones.filter((d) => !paisId || d.PaisID === Number(paisId));
            return [
                { value: '', label: items.length ? 'Seleccione una división' : 'Sin divisiones registradas' },
                ...items.map((d) => ({
                    value: d.DivisionTerritorialID,
                    label: `${d.Nombre} (${d.TipoDivision})`,
                    selected: Number(selected) === d.DivisionTerritorialID
                }))
            ];
        }

        function opcionesCiudades(divisionId, selected = '') {
            const items = ciudades.filter((c) => !divisionId || c.DivisionTerritorialID === Number(divisionId));
            return [
                { value: '', label: items.length ? 'Seleccione una ciudad' : 'Sin ciudades registradas' },
                ...items.map((c) => ({
                    value: c.CiudadID,
                    label: c.Nombre,
                    selected: Number(selected) === c.CiudadID
                }))
            ];
        }

        function nuevoBoton() {
            const labels = {
                paises: '+ Nuevo país',
                divisiones: '+ Nueva división',
                ciudades: '+ Nueva ciudad',
                sucursales: '+ Nueva sucursal'
            };
            const handlers = {
                paises: () => formularioPais(null),
                divisiones: () => formularioDivision(null),
                ciudades: () => formularioCiudad(null),
                sucursales: () => formularioSucursal(null)
            };
            if (!ctx.puede('UBICACIONES.GESTIONAR')) return null;
            return el('button', {
                class: 'btn btn-primary',
                text: labels[activeTab],
                on: { click: handlers[activeTab] }
            });
        }

        function tablaPaises() {
            const tbody = el('tbody');
            if (paises.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 7 },
                    emptyState('Sin países', 'Registre el primer país donde opera la empresa.'))));
            }
            for (const pais of paises) {
                const divisionesPais = divisiones.filter((d) => d.PaisID === pais.PaisID);
                const ciudadesPais = ciudades.filter((c) => c.PaisID === pais.PaisID);
                const sucursalesPais = sucursales.filter((s) => s.PaisID === pais.PaisID);
                tbody.appendChild(el('tr', {},
                    el('td', {}, el('strong', { text: pais.Nombre })),
                    el('td', { class: 'muted', text: pais.CodigoISO2 || '—' }),
                    el('td', { class: 'num', text: divisionesPais.length }),
                    el('td', { class: 'num', text: ciudadesPais.length }),
                    el('td', { class: 'num', text: sucursalesPais.length }),
                    el('td', {}, pais.Activo ? badge('Activo', 'success') : badge('Inactivo', 'neutral')),
                    el('td', {}, el('div', { class: 'actions-cell' },
                        el('button', {
                            class: 'btn btn-ghost btn-sm', text: 'Editar',
                            on: { click: () => formularioPais(pais) }
                        }),
                        el('button', {
                            class: 'btn btn-ghost btn-sm',
                            text: pais.Activo ? 'Desactivar' : 'Activar',
                            on: { click: () => cambiarEstadoPais(pais) }
                        })
                    ))
                ));
            }
            return tabla('País', 'ISO', 'Divisiones', 'Ciudades', 'Sucursales', 'Estado', tbody);
        }

        function tablaDivisiones() {
            const tbody = el('tbody');
            if (divisiones.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 6 },
                    emptyState('Sin divisiones', 'Registre departamentos, estados o provincias.'))));
            }
            for (const division of divisiones) {
                const ciudadesDivision = ciudades.filter((c) => c.DivisionTerritorialID === division.DivisionTerritorialID);
                tbody.appendChild(el('tr', {},
                    el('td', { text: division.Pais }),
                    el('td', { class: 'muted', text: division.TipoDivision }),
                    el('td', {}, el('strong', { text: division.Nombre })),
                    el('td', { class: 'num', text: ciudadesDivision.length }),
                    el('td', {}, division.Activa ? badge('Activa', 'success') : badge('Inactiva', 'neutral')),
                    el('td', {}, el('div', { class: 'actions-cell' },
                        el('button', {
                            class: 'btn btn-ghost btn-sm', text: 'Editar',
                            on: { click: () => formularioDivision(division) }
                        }),
                        el('button', {
                            class: 'btn btn-ghost btn-sm',
                            text: division.Activa ? 'Desactivar' : 'Activar',
                            on: { click: () => cambiarEstadoDivision(division) }
                        })
                    ))
                ));
            }
            return tabla('País', 'Tipo', 'División territorial', 'Ciudades', 'Estado', tbody);
        }

        function tablaCiudades() {
            const tbody = el('tbody');
            if (ciudades.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 6 },
                    emptyState('Sin ciudades', 'Registre las ciudades de cada división territorial.'))));
            }
            for (const ciudad of ciudades) {
                const sucursalesCiudad = sucursales.filter((s) => s.CiudadID === ciudad.CiudadID);
                tbody.appendChild(el('tr', {},
                    el('td', { text: ciudad.Pais }),
                    el('td', { class: 'muted', text: ciudad.DivisionTerritorial }),
                    el('td', {}, el('strong', { text: ciudad.Nombre })),
                    el('td', { class: 'num', text: sucursalesCiudad.length }),
                    el('td', {}, ciudad.Activa ? badge('Activa', 'success') : badge('Inactiva', 'neutral')),
                    el('td', {}, el('div', { class: 'actions-cell' },
                        el('button', {
                            class: 'btn btn-ghost btn-sm', text: 'Editar',
                            on: { click: () => formularioCiudad(ciudad) }
                        }),
                        el('button', {
                            class: 'btn btn-ghost btn-sm',
                            text: ciudad.Activa ? 'Desactivar' : 'Activar',
                            on: { click: () => cambiarEstadoCiudad(ciudad) }
                        })
                    ))
                ));
            }
            return tabla('País', 'División', 'Ciudad', 'Sucursales', 'Estado', tbody);
        }

        function tablaSucursales() {
            const tbody = el('tbody');
            if (sucursales.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 8 },
                    emptyState('Sin sucursales', 'Registre la primera sucursal de la empresa.'))));
            }
            for (const sucursal of sucursales) {
                tbody.appendChild(el('tr', {},
                    el('td', {}, el('strong', { text: sucursal.CodigoSucursal })),
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('strong', { text: sucursal.Nombre }),
                            el('small', { text: `${sucursal.Ciudad} · ${sucursal.DivisionTerritorial}` })
                        )
                    ),
                    el('td', { text: sucursal.Pais }),
                    el('td', { class: 'muted', text: sucursal.Direccion }),
                    el('td', { class: 'muted', text: sucursal.Telefono || '—' }),
                    el('td', {}, sucursal.Activa ? badge('Activa', 'success') : badge('Inactiva', 'neutral')),
                    el('td', {}, el('div', { class: 'actions-cell' },
                        el('button', {
                            class: 'btn btn-ghost btn-sm', text: 'Editar',
                            on: { click: () => formularioSucursal(sucursal) }
                        }),
                        el('button', {
                            class: 'btn btn-ghost btn-sm',
                            text: sucursal.Activa ? 'Desactivar' : 'Activar',
                            on: { click: () => cambiarEstadoSucursal(sucursal) }
                        })
                    ))
                ));
            }
            return tabla('Código', 'Sucursal', 'País', 'Dirección', 'Teléfono', 'Estado', tbody);
        }

        function tabla(...headers) {
            const tbody = headers.pop();
            return el('div', { class: 'table-wrap' },
                el('table', { class: 'data' },
                    el('thead', {}, el('tr', {},
                        ...headers.filter((h) => h !== undefined).map((h, index) => el('th', {
                            class: index === headers.length - 1 ? 'text-right' : '',
                            text: h
                        })),
                        el('th', { class: 'text-right', text: 'Acciones' })
                    )),
                    tbody
                )
            );
        }

        function renderPage() {
            clear(root);
            const boton = nuevoBoton();
            root.appendChild(pageHead(
                'Ubicaciones y sucursales',
                'Organice la empresa por país, división territorial, ciudad y sucursal.',
                boton ? [boton] : []
            ));

            root.appendChild(tabs([
                { key: 'paises', label: 'Países' },
                { key: 'divisiones', label: 'Divisiones' },
                { key: 'ciudades', label: 'Ciudades' },
                { key: 'sucursales', label: 'Sucursales' }
            ], activeTab, (key) => {
                activeTab = key;
                renderPage();
            }));

            const contenido = {
                paises: tablaPaises,
                divisiones: tablaDivisiones,
                ciudades: tablaCiudades,
                sucursales: tablaSucursales
            }[activeTab]();

            root.appendChild(el('section', { class: 'card' }, contenido));
        }

        function formularioPais(pais) {
            openModal({
                title: pais ? 'Editar país' : 'Nuevo país',
                subtitle: pais ? pais.Nombre : 'Registre un país donde la empresa tenga operaciones.',
                body: el('div', { class: 'form-grid' },
                    field('Nombre del país', input('nombre', {
                        value: pais?.Nombre || '', required: true, maxlength: 100
                    })),
                    field('Código ISO (2 letras)', input('codigoISO2', {
                        value: pais?.CodigoISO2 || '', maxlength: 2, placeholder: 'SV'
                    })),
                    pais ? el('label', { class: 'checkbox span-2' },
                        el('input', { type: 'checkbox', name: 'activo', checked: Boolean(pais.Activo) }),
                        'País activo'
                    ) : null
                ),
                submitLabel: pais ? 'Guardar cambios' : 'Crear país',
                onSubmit: async (data) => {
                    const payload = {
                        nombre: data.nombre,
                        codigoISO2: data.codigoISO2,
                        activo: pais ? data.activo === 'on' : true
                    };
                    if (pais) await api.put(`/geografia/paises/${pais.PaisID}`, payload);
                    else await api.post('/geografia/paises', payload);
                    toast(pais ? 'País actualizado.' : 'País creado.', 'success');
                    await cargar();
                    renderPage();
                }
            });
        }

        function formularioDivision(division) {
            openModal({
                title: division ? 'Editar división territorial' : 'Nueva división territorial',
                subtitle: 'Departamento, estado, provincia o región.',
                body: el('div', { class: 'form-grid' },
                    field('País', select('paisId', opcionesPaises(division?.PaisID), { required: true })),
                    field('Tipo de división', select('tipoDivision', TIPOS_DIVISION.map((tipo) => ({
                        value: tipo,
                        label: tipo,
                        selected: division?.TipoDivision === tipo
                    })), { required: true })),
                    el('div', { class: 'span-2' },
                        field('Nombre', input('nombre', {
                            value: division?.Nombre || '', required: true, maxlength: 100
                        }))
                    ),
                    division ? el('label', { class: 'checkbox span-2' },
                        el('input', { type: 'checkbox', name: 'activa', checked: Boolean(division.Activa) }),
                        'División activa'
                    ) : null
                ),
                submitLabel: division ? 'Guardar cambios' : 'Crear división',
                onSubmit: async (data) => {
                    const payload = {
                        paisId: data.paisId,
                        tipoDivision: data.tipoDivision,
                        nombre: data.nombre,
                        activa: division ? data.activa === 'on' : true
                    };
                    if (division) await api.put(`/geografia/divisiones/${division.DivisionTerritorialID}`, payload);
                    else await api.post('/geografia/divisiones', payload);
                    toast(division ? 'División actualizada.' : 'División creada.', 'success');
                    await cargar();
                    renderPage();
                }
            });
        }

        function formularioCiudad(ciudad) {
            const divisionActual = ciudad
                ? divisiones.find((d) => d.DivisionTerritorialID === ciudad.DivisionTerritorialID)
                : null;
            const paisActual = divisionActual?.PaisID || '';

            const paisSelect = select('paisId', opcionesPaises(paisActual), { required: true });
            const divisionSelect = select('divisionId', opcionesDivisiones(paisActual, ciudad?.DivisionTerritorialID), {
                required: true
            });

            function refrescarDivisiones() {
                const paisId = Number(paisSelect.value);
                clear(divisionSelect);
                for (const option of opcionesDivisiones(paisId)) {
                    divisionSelect.appendChild(el('option', {
                        value: option.value, text: option.label, selected: option.selected
                    }));
                }
            }
            paisSelect.addEventListener('change', refrescarDivisiones);

            openModal({
                title: ciudad ? 'Editar ciudad' : 'Nueva ciudad',
                subtitle: 'Ciudad asociada a una división territorial.',
                body: el('div', { class: 'form-grid' },
                    field('País', paisSelect),
                    field('División territorial', divisionSelect),
                    el('div', { class: 'span-2' },
                        field('Nombre de la ciudad', input('nombre', {
                            value: ciudad?.Nombre || '', required: true, maxlength: 100
                        }))
                    ),
                    ciudad ? el('label', { class: 'checkbox span-2' },
                        el('input', { type: 'checkbox', name: 'activa', checked: Boolean(ciudad.Activa) }),
                        'Ciudad activa'
                    ) : null
                ),
                submitLabel: ciudad ? 'Guardar cambios' : 'Crear ciudad',
                onSubmit: async (data) => {
                    const payload = {
                        divisionId: data.divisionId,
                        nombre: data.nombre,
                        activa: ciudad ? data.activa === 'on' : true
                    };
                    if (ciudad) await api.put(`/geografia/ciudades/${ciudad.CiudadID}`, payload);
                    else await api.post('/geografia/ciudades', payload);
                    toast(ciudad ? 'Ciudad actualizada.' : 'Ciudad creada.', 'success');
                    await cargar();
                    renderPage();
                }
            });
        }

        function formularioSucursal(sucursal) {
            const ciudadActual = sucursal
                ? ciudades.find((c) => c.CiudadID === sucursal.CiudadID)
                : null;
            const divisionActual = ciudadActual
                ? divisiones.find((d) => d.DivisionTerritorialID === ciudadActual.DivisionTerritorialID)
                : null;
            const paisActual = divisionActual?.PaisID || '';

            const paisSelect = select('paisId', opcionesPaises(paisActual), { required: true });
            const divisionSelect = select('divisionId', opcionesDivisiones(paisActual, divisionActual?.DivisionTerritorialID), {
                required: true
            });
            const ciudadSelect = select('ciudadId', opcionesCiudades(divisionActual?.DivisionTerritorialID, ciudadActual?.CiudadID), {
                required: true
            });

            function refrescarDivisiones() {
                const paisId = Number(paisSelect.value);
                clear(divisionSelect);
                for (const option of opcionesDivisiones(paisId)) {
                    divisionSelect.appendChild(el('option', {
                        value: option.value, text: option.label, selected: option.selected
                    }));
                }
                refrescarCiudades();
            }

            function refrescarCiudades() {
                const divisionId = Number(divisionSelect.value);
                clear(ciudadSelect);
                for (const option of opcionesCiudades(divisionId)) {
                    ciudadSelect.appendChild(el('option', {
                        value: option.value, text: option.label, selected: option.selected
                    }));
                }
            }

            paisSelect.addEventListener('change', refrescarDivisiones);
            divisionSelect.addEventListener('change', refrescarCiudades);

            openModal({
                title: sucursal ? 'Editar sucursal' : 'Nueva sucursal',
                subtitle: 'Cada sucursal pertenece a una ciudad y administra su propio inventario.',
                body: el('div', { class: 'form-grid' },
                    field('País', paisSelect),
                    field('División territorial', divisionSelect),
                    field('Ciudad', ciudadSelect),
                    field('Código de sucursal', input('codigoSucursal', {
                        value: sucursal?.CodigoSucursal || '', required: true, maxlength: 20, placeholder: 'SUC-001'
                    })),
                    field('Nombre', input('nombre', {
                        value: sucursal?.Nombre || '', required: true, maxlength: 120
                    })),
                    field('Teléfono', input('telefono', {
                        value: sucursal?.Telefono || '', maxlength: 30
                    })),
                    el('div', { class: 'span-2' },
                        field('Dirección', input('direccion', {
                            value: sucursal?.Direccion || '', required: true, maxlength: 250
                        }))
                    ),
                    sucursal ? el('label', { class: 'checkbox span-2' },
                        el('input', { type: 'checkbox', name: 'activa', checked: Boolean(sucursal.Activa) }),
                        'Sucursal activa'
                    ) : null
                ),
                submitLabel: sucursal ? 'Guardar cambios' : 'Crear sucursal',
                onSubmit: async (data) => {
                    const payload = {
                        ciudadId: data.ciudadId,
                        codigoSucursal: data.codigoSucursal,
                        nombre: data.nombre,
                        direccion: data.direccion,
                        telefono: data.telefono,
                        activa: sucursal ? data.activa === 'on' : true
                    };
                    if (sucursal) await api.put(`/geografia/sucursales/${sucursal.SucursalID}`, payload);
                    else await api.post('/geografia/sucursales', payload);
                    toast(sucursal ? 'Sucursal actualizada.' : 'Sucursal creada.', 'success');
                    await cargar();
                    renderPage();
                }
            });
        }

        async function cambiarEstadoPais(pais) {
            const desactivar = pais.Activo;
            const ok = await confirmDialog({
                title: desactivar ? 'Desactivar país' : 'Activar país',
                message: desactivar
                    ? `¿Desea desactivar "${pais.Nombre}"? Sus sucursales no se eliminarán.`
                    : `¿Desea activar nuevamente "${pais.Nombre}"?`,
                confirmLabel: desactivar ? 'Desactivar' : 'Activar',
                danger: desactivar
            });
            if (!ok) return;
            await api.put(`/geografia/paises/${pais.PaisID}`, {
                nombre: pais.Nombre, codigoISO2: pais.CodigoISO2, activo: !pais.Activo
            });
            toast(desactivar ? 'País desactivado.' : 'País activado.', 'success');
            await cargar();
            renderPage();
        }

        async function cambiarEstadoDivision(division) {
            const desactivar = division.Activa;
            const ok = await confirmDialog({
                title: desactivar ? 'Desactivar división' : 'Activar división',
                message: desactivar
                    ? `¿Desea desactivar "${division.Nombre}"? Sus ciudades no se eliminarán.`
                    : `¿Desea activar nuevamente "${division.Nombre}"?`,
                confirmLabel: desactivar ? 'Desactivar' : 'Activar',
                danger: desactivar
            });
            if (!ok) return;
            await api.put(`/geografia/divisiones/${division.DivisionTerritorialID}`, {
                paisId: division.PaisID,
                tipoDivision: division.TipoDivision,
                nombre: division.Nombre,
                activa: !division.Activa
            });
            toast(desactivar ? 'División desactivada.' : 'División activada.', 'success');
            await cargar();
            renderPage();
        }

        async function cambiarEstadoCiudad(ciudad) {
            const desactivar = ciudad.Activa;
            const ok = await confirmDialog({
                title: desactivar ? 'Desactivar ciudad' : 'Activar ciudad',
                message: desactivar
                    ? `¿Desea desactivar "${ciudad.Nombre}"? Sus sucursales no se eliminarán.`
                    : `¿Desea activar nuevamente "${ciudad.Nombre}"?`,
                confirmLabel: desactivar ? 'Desactivar' : 'Activar',
                danger: desactivar
            });
            if (!ok) return;
            await api.put(`/geografia/ciudades/${ciudad.CiudadID}`, {
                divisionId: ciudad.DivisionTerritorialID,
                nombre: ciudad.Nombre,
                activa: !ciudad.Activa
            });
            toast(desactivar ? 'Ciudad desactivada.' : 'Ciudad activada.', 'success');
            await cargar();
            renderPage();
        }

        async function cambiarEstadoSucursal(sucursal) {
            const desactivar = sucursal.Activa;
            const ok = await confirmDialog({
                title: desactivar ? 'Desactivar sucursal' : 'Activar sucursal',
                message: desactivar
                    ? `¿Desea desactivar "${sucursal.Nombre}"? Su inventario se conservará.`
                    : `¿Desea activar nuevamente "${sucursal.Nombre}"?`,
                confirmLabel: desactivar ? 'Desactivar' : 'Activar',
                danger: desactivar
            });
            if (!ok) return;
            await api.put(`/geografia/sucursales/${sucursal.SucursalID}`, {
                ciudadId: sucursal.CiudadID,
                codigoSucursal: sucursal.CodigoSucursal,
                nombre: sucursal.Nombre,
                direccion: sucursal.Direccion,
                telefono: sucursal.Telefono,
                activa: !sucursal.Activa
            });
            toast(desactivar ? 'Sucursal desactivada.' : 'Sucursal activada.', 'success');
            await cargar();
            renderPage();
        }

        await cargar();
        clear(root);
        renderPage();
    }
}
