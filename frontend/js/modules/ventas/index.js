import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, field, input, select, textarea,
    formatMoney, formatNumber, formatDateTime, estadoBadge,
    emptyState, loading, openModal, toast, confirmDialog
} from '../../core/ui.js';
import { ItemsEditor } from '../../core/items.js';

function nuevoComprobante() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const random = Math.floor(Math.random() * 9000 + 1000);
    return `V-${stamp}-${random}`;
}

function mapaExistencias(registros) {
    const mapa = new Map();
    for (const registro of registros) {
        const clave = Number(registro.ProductoID);
        mapa.set(clave, (mapa.get(clave) || 0) + Number(registro.Cantidad));
    }
    return mapa;
}

export class VentasPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando ventas…'));

        const filtros = {
            estado: '',
            clienteId: '',
            desde: '',
            hasta: ''
        };

        let ventas = [];
        let clientes = [];
        let productos = [];

        const puedeRegistrar = ctx.puede('VENTAS.REGISTRAR');

        async function cargarTodo() {
            const [ventasResponse, clientesResponse, productosResponse] = await Promise.all([
                api.get('/ventas', {
                    estado: filtros.estado,
                    clienteId: filtros.clienteId,
                    desde: filtros.desde,
                    hasta: filtros.hasta,
                    sucursalId: ctx.sucursalId
                }),
                api.get('/catalogos/clientes'),
                api.get('/catalogos/productos')
            ]);
            ventas = ventasResponse.datos;
            clientes = clientesResponse.datos;
            productos = productosResponse.datos;
        }

        await cargarTodo();
        clear(container);

        const root = el('div');
        container.appendChild(root);

        function renderPagina() {
            clear(root);

            root.appendChild(pageHead(
                'Ventas',
                'Registre las ventas y confírmelas para descontar existencias.',
                puedeRegistrar
                    ? [
                        el('button', {
                            class: 'btn btn-secondary', text: '+ Nuevo cliente',
                            on: { click: () => formularioCliente() }
                        }),
                        el('button', {
                            class: 'btn btn-primary', text: '+ Nueva venta',
                            on: { click: () => formularioVenta() }
                        })
                    ]
                    : []
            ));

            const registradas = ventas.filter((v) => v.Estado === 'REGISTRADA');
            const confirmadas = ventas.filter((v) => v.Estado === 'CONFIRMADA');
            const totalConfirmado = confirmadas.reduce((sum, v) => sum + Number(v.TotalVenta), 0);

            root.appendChild(el('div', { class: 'stat-grid' },
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon', text: '▤' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Ventas listadas' }),
                        el('strong', { text: formatNumber(ventas.length) })
                    )
                ),
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon amber', text: '⌛' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Pendientes de confirmar' }),
                        el('strong', { text: formatNumber(registradas.length) })
                    )
                ),
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon green', text: '$' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Monto confirmado' }),
                        el('strong', { text: formatMoney(totalConfirmado) })
                    )
                )
            ));

            const estadoSelect = select('estado', [
                { value: '', label: 'Todos los estados' },
                { value: 'REGISTRADA', label: 'Registrada' },
                { value: 'CONFIRMADA', label: 'Confirmada' },
                { value: 'CANCELADA', label: 'Cancelada' }
            ], { class: 'select input-sm', style: { maxWidth: '190px' } });
            estadoSelect.value = filtros.estado;

            const clienteSelect = select('clienteId', [
                { value: '', label: 'Todos los clientes' },
                ...clientes.map((c) => ({ value: c.ClienteID, label: c.Nombre }))
            ], { class: 'select input-sm', style: { maxWidth: '230px' } });
            clienteSelect.value = filtros.clienteId;

            const desdeInput = el('input', { class: 'input input-sm', type: 'date', value: filtros.desde });
            const hastaInput = el('input', { class: 'input input-sm', type: 'date', value: filtros.hasta });

            const tbody = el('tbody');

            if (ventas.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 8 }, emptyState(
                    'Sin ventas', 'Registre la primera venta del sistema.'
                ))));
            }

            for (const venta of ventas) {
                const acciones = [
                    el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Ver',
                        on: { click: () => verDetalle(venta.VentaID) }
                    })
                ];

                if (puedeRegistrar && venta.Estado === 'REGISTRADA') {
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Confirmar',
                        on: { click: () => confirmarVenta(venta) }
                    }));
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Cancelar',
                        on: { click: () => cancelarVenta(venta) }
                    }));
                }

                tbody.appendChild(el('tr', {},
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('strong', { text: venta.NumeroComprobante }),
                            el('small', { text: `#${venta.VentaID} · ${venta.Lineas} línea(s)` })
                        )
                    ),
                    el('td', { text: venta.Cliente || 'Consumidor final' }),
                    el('td', { text: venta.Sucursal }),
                    el('td', { class: 'small', text: formatDateTime(venta.FechaVenta) }),
                    el('td', { class: 'muted small', text: formatDateTime(venta.FechaConfirmacion) }),
                    el('td', { class: 'num', text: formatMoney(venta.TotalVenta) }),
                    el('td', {}, estadoBadge(venta.Estado)),
                    el('td', {}, el('div', { class: 'actions-cell' }, ...acciones))
                ));
            }

            root.appendChild(el('section', { class: 'card' },
                el('div', { class: 'toolbar' },
                    estadoSelect,
                    clienteSelect,
                    el('div', { class: 'field-inline' }, el('span', { text: 'Desde' }), desdeInput),
                    el('div', { class: 'field-inline' }, el('span', { text: 'Hasta' }), hastaInput),
                    el('span', { class: 'spacer' }),
                    el('button', {
                        class: 'btn btn-primary btn-sm', text: 'Aplicar filtros',
                        on: {
                            click: async () => {
                                filtros.estado = estadoSelect.value;
                                filtros.clienteId = clienteSelect.value;
                                filtros.desde = desdeInput.value;
                                filtros.hasta = hastaInput.value;
                                await recargar();
                            }
                        }
                    })
                ),
                el('div', { class: 'table-wrap' },
                    el('table', { class: 'data' },
                        el('thead', {}, el('tr', {},
                            el('th', { text: 'Comprobante' }),
                            el('th', { text: 'Cliente' }),
                            el('th', { text: 'Sucursal' }),
                            el('th', { text: 'Fecha de venta' }),
                            el('th', { text: 'Confirmación' }),
                            el('th', { class: 'num', text: 'Total' }),
                            el('th', { text: 'Estado' }),
                            el('th', { class: 'text-right', text: 'Acciones' })
                        )),
                        tbody
                    )
                )
            ));
        }

        async function recargar() {
            try {
                await cargarTodo();
            } finally {
                renderPagina();
            }
        }

        function formularioVenta() {
            if (productos.length === 0) {
                toast('No hay productos activos para vender.', 'warning');
                return;
            }
            if (ctx.sucursales.length === 0) {
                toast('No hay sucursales disponibles para registrar la venta.', 'warning');
                return;
            }

            const sucursalSelect = select('sucursalId', ctx.sucursales.map((s) => ({
                value: s.SucursalID,
                label: `${s.CodigoSucursal} · ${s.Nombre}`,
                selected: Number(ctx.sucursalId) === Number(s.SucursalID)
            })), { required: true });

            const clienteSelect = select('clienteId', [
                { value: '', label: 'Consumidor final' },
                ...clientes.map((c) => ({ value: c.ClienteID, label: c.Nombre }))
            ]);

            const hostEditor = el('div');

            let existencias = new Map();

            function montarEditor() {
                const editor = new ItemsEditor({ productos, tipo: 'venta', existencias });
                clear(hostEditor);
                hostEditor.appendChild(editor.element);
                return editor;
            }

            let editorActual = montarEditor();

            async function cargarExistencias() {
                const sucursalId = Number(sucursalSelect.value);
                if (!sucursalId) {
                    existencias = new Map();
                    return;
                }
                const response = await api.get('/inventario', { sucursalId });
                existencias = mapaExistencias(response.datos);
            }

            sucursalSelect.addEventListener('change', async () => {
                clear(hostEditor);
                hostEditor.appendChild(loading('Cargando existencias de la sucursal…'));
                try {
                    await cargarExistencias();
                    editorActual = montarEditor();
                } catch (error) {
                    hostEditor.appendChild(el('div', { class: 'info-banner danger' },
                        el('span', { text: error.message })));
                }
            });

            openModal({
                title: 'Nueva venta',
                subtitle: 'Las existencias se descuentan al confirmar la venta.',
                size: 'modal-lg',
                body: el('div', { class: 'stack' },
                    el('div', { class: 'form-grid' },
                        field('Sucursal', sucursalSelect),
                        field('Cliente', clienteSelect),
                        el('div', { class: 'span-2' },
                            field('Número de comprobante', input('numeroComprobante', {
                                required: true, maxlength: 60, value: nuevoComprobante()
                            }), 'La venta se registra con la fecha y hora actuales.')
                        )
                    ),
                    el('div', { class: 'form-section-title', text: 'Detalle de productos' }),
                    hostEditor,
                    field('Observaciones', textarea('observaciones', {
                        maxlength: 300, rows: 2, placeholder: 'Observaciones opcionales…'
                    }))
                ),
                submitLabel: 'Registrar venta',
                onSubmit: async (data) => {
                    const items = editorActual.obtenerItems();
                    await api.post('/ventas', {
                        sucursalId: data.sucursalId,
                        clienteId: data.clienteId || null,
                        numeroComprobante: data.numeroComprobante,
                        observaciones: data.observaciones,
                        items
                    });
                    toast('Venta registrada. Confírmela para descontar existencias.', 'success');
                    await recargar();
                }
            });

            // Carga inicial de existencias de la sucursal seleccionada.
            cargarExistencias()
                .then(() => { editorActual = montarEditor(); })
                .catch(() => {});
        }

        function formularioCliente() {
            openModal({
                title: 'Nuevo cliente',
                subtitle: 'El cliente quedará disponible para futuras ventas.',
                body: el('div', { class: 'form-grid' },
                    field('Nombre', input('nombre', { required: true, maxlength: 150 })),
                    field('Documento', input('numeroDocumento', { maxlength: 40 })),
                    field('Teléfono', input('telefono', { maxlength: 30 })),
                    field('Correo', input('correo', { type: 'email', maxlength: 150 }))
                ),
                submitLabel: 'Crear cliente',
                onSubmit: async (data) => {
                    await api.post('/catalogos/clientes', data);
                    toast('Cliente creado.', 'success');
                    await recargar();
                }
            });
        }

        async function verDetalle(id) {
            const data = await api.get(`/ventas/${id}`);
            const venta = data.dato;

            const detalle = el('div', { class: 'table-wrap' },
                el('table', { class: 'data' },
                    el('thead', {}, el('tr', {},
                        el('th', { text: 'Producto' }),
                        el('th', { class: 'num', text: 'Cantidad' }),
                        el('th', { class: 'num', text: 'Precio unitario' }),
                        el('th', { class: 'num', text: 'Subtotal' })
                    )),
                    el('tbody', {},
                        ...data.detalle.map((linea) => el('tr', {},
                            el('td', {},
                                el('div', { class: 'product-cell' },
                                    el('strong', { text: linea.Producto }),
                                    el('small', { text: linea.Codigo })
                                )
                            ),
                            el('td', { class: 'num', text: formatNumber(linea.Cantidad) }),
                            el('td', { class: 'num', text: formatMoney(linea.PrecioUnitario) }),
                            el('td', { class: 'num', text: formatMoney(linea.Subtotal) })
                        ))
                    )
                )
            );

            openModal({
                title: `Venta ${venta.NumeroComprobante}`,
                subtitle: `Registrada por ${venta.UsuarioRegistro}`,
                size: 'modal-lg',
                hideSubmit: true,
                cancelLabel: 'Cerrar',
                body: el('div', { class: 'stack' },
                    el('div', { class: 'detail-grid' },
                        el('div', { class: 'detail' }, el('span', { text: 'Cliente' }), el('strong', { text: venta.Cliente || 'Consumidor final' })),
                        el('div', { class: 'detail' }, el('span', { text: 'Sucursal' }), el('strong', { text: venta.Sucursal })),
                        el('div', { class: 'detail' }, el('span', { text: 'Estado' }), estadoBadge(venta.Estado)),
                        el('div', { class: 'detail' }, el('span', { text: 'Fecha de venta' }), el('strong', { text: formatDateTime(venta.FechaVenta) })),
                        el('div', { class: 'detail' }, el('span', { text: 'Fecha de confirmación' }), el('strong', { text: formatDateTime(venta.FechaConfirmacion) })),
                        el('div', { class: 'detail' }, el('span', { text: 'Confirmada por' }), el('strong', { text: venta.UsuarioConfirmacion || '—' }))
                    ),
                    venta.Observaciones
                        ? el('div', { class: 'info-banner' }, el('span', { text: venta.Observaciones }))
                        : null,
                    detalle,
                    el('div', { class: 'total-line' }, el('span', { text: 'Total de la venta' }), el('strong', { text: formatMoney(venta.TotalVenta) }))
                )
            });
        }

        async function confirmarVenta(venta) {
            const ok = await confirmDialog({
                title: 'Confirmar venta',
                message: `¿Confirma la venta ${venta.NumeroComprobante}? Se descontarán las existencias de ${venta.Sucursal}.`,
                confirmLabel: 'Confirmar venta'
            });
            if (!ok) return;

            try {
                await api.post(`/ventas/${venta.VentaID}/confirmar`);
                toast('Venta confirmada y existencias descontadas.', 'success');
                await recargar();
            } catch (error) {
                toast(error.message, 'error');
            }
        }

        async function cancelarVenta(venta) {
            const ok = await confirmDialog({
                title: 'Cancelar venta',
                message: `¿Desea cancelar la venta ${venta.NumeroComprobante}? Esta acción no modifica el inventario.`,
                confirmLabel: 'Cancelar venta',
                danger: true
            });
            if (!ok) return;

            try {
                await api.post(`/ventas/${venta.VentaID}/cancelar`);
                toast('Venta cancelada.', 'success');
                await recargar();
            } catch (error) {
                toast(error.message, 'error');
            }
        }

        renderPagina();
    }
}
