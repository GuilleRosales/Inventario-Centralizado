import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, field, input, select, textarea,
    formatNumber, formatDateTime, estadoBadge,
    emptyState, loading, openModal, toast, confirmDialog
} from '../../core/ui.js';
import { ItemsEditor } from '../../core/items.js';

function mapaExistencias(registros) {
    const mapa = new Map();
    for (const registro of registros) {
        const clave = Number(registro.ProductoID);
        mapa.set(clave, (mapa.get(clave) || 0) + Number(registro.Cantidad));
    }
    return mapa;
}

function opcionesSucursales(sucursales, vacio = 'Todas las sucursales', selected = '') {
    return [
        { value: '', label: vacio },
        ...sucursales.map((s) => ({
            value: s.SucursalID,
            label: `${s.CodigoSucursal} · ${s.Nombre}`,
            selected: Number(selected) === Number(s.SucursalID)
        }))
    ];
}

export class TransferenciasPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando transferencias…'));

        const filtros = {
            estado: '',
            origenId: '',
            destinoId: '',
            desde: '',
            hasta: ''
        };

        let transferencias = [];
        let productos = [];

        const puedeGestionar = ctx.puede('TRANSFERENCIAS.GESTIONAR');

        async function cargarTodo() {
            const [transferenciasResponse, productosResponse] = await Promise.all([
                api.get('/transferencias', {
                    estado: filtros.estado,
                    origenId: filtros.origenId,
                    destinoId: filtros.destinoId,
                    desde: filtros.desde,
                    hasta: filtros.hasta
                }),
                api.get('/catalogos/productos')
            ]);
            transferencias = transferenciasResponse.datos;
            productos = productosResponse.datos;
        }

        await cargarTodo();
        clear(container);

        const root = el('div');
        container.appendChild(root);

        function renderPagina() {
            clear(root);

            root.appendChild(pageHead(
                'Transferencias entre sucursales',
                'Solicite y confirme el traslado de productos entre sucursales.',
                puedeGestionar
                    ? [el('button', {
                        class: 'btn btn-primary', text: '+ Nueva transferencia',
                        on: { click: () => formularioTransferencia() }
                    })]
                    : []
            ));

            const solicitadas = transferencias.filter((t) => t.Estado === 'SOLICITADA');
            const confirmadas = transferencias.filter((t) => t.Estado === 'CONFIRMADA');

            root.appendChild(el('div', { class: 'stat-grid' },
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon', text: '⇄' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Transferencias listadas' }),
                        el('strong', { text: formatNumber(transferencias.length) })
                    )
                ),
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon amber', text: '⌛' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Solicitadas' }),
                        el('strong', { text: formatNumber(solicitadas.length) })
                    )
                ),
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon green', text: '✓' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Confirmadas' }),
                        el('strong', { text: formatNumber(confirmadas.length) })
                    )
                )
            ));

            const estadoSelect = select('estado', [
                { value: '', label: 'Todos los estados' },
                { value: 'SOLICITADA', label: 'Solicitada' },
                { value: 'CONFIRMADA', label: 'Confirmada' },
                { value: 'CANCELADA', label: 'Cancelada' }
            ], { class: 'select input-sm', style: { maxWidth: '190px' } });
            estadoSelect.value = filtros.estado;

            const origenSelect = select('origenId', opcionesSucursales(ctx.sucursales, 'Origen: todas', filtros.origenId), {
                class: 'select input-sm', style: { maxWidth: '230px' }
            });
            const destinoSelect = select('destinoId', opcionesSucursales(ctx.sucursales, 'Destino: todas', filtros.destinoId), {
                class: 'select input-sm', style: { maxWidth: '230px' }
            });

            const desdeInput = el('input', { class: 'input input-sm', type: 'date', value: filtros.desde });
            const hastaInput = el('input', { class: 'input input-sm', type: 'date', value: filtros.hasta });

            const tbody = el('tbody');

            if (transferencias.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 8 }, emptyState(
                    'Sin transferencias', 'Cree la primera transferencia entre sucursales.'
                ))));
            }

            for (const transferencia of transferencias) {
                const acciones = [
                    el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Ver',
                        on: { click: () => verDetalle(transferencia.TransferenciaID) }
                    })
                ];

                if (puedeGestionar && transferencia.Estado === 'SOLICITADA') {
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Confirmar',
                        on: { click: () => confirmarTransferencia(transferencia) }
                    }));
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Cancelar',
                        on: { click: () => cancelarTransferencia(transferencia) }
                    }));
                }

                tbody.appendChild(el('tr', {},
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('strong', { text: transferencia.CodigoReferencia }),
                            el('small', { text: `${transferencia.Lineas} línea(s)` })
                        )
                    ),
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('span', { text: transferencia.SucursalOrigen }),
                            el('small', { text: 'Origen' })
                        )
                    ),
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('span', { text: transferencia.SucursalDestino }),
                            el('small', { text: 'Destino' })
                        )
                    ),
                    el('td', { class: 'small', text: formatDateTime(transferencia.FechaSolicitud) }),
                    el('td', { class: 'muted small', text: formatDateTime(transferencia.FechaConfirmacion) }),
                    el('td', { class: 'small', text: transferencia.UsuarioSolicita }),
                    el('td', {}, estadoBadge(transferencia.Estado)),
                    el('td', {}, el('div', { class: 'actions-cell' }, ...acciones))
                ));
            }

            root.appendChild(el('section', { class: 'card' },
                el('div', { class: 'toolbar' },
                    estadoSelect,
                    origenSelect,
                    destinoSelect,
                    el('div', { class: 'field-inline' }, el('span', { text: 'Desde' }), desdeInput),
                    el('div', { class: 'field-inline' }, el('span', { text: 'Hasta' }), hastaInput),
                    el('span', { class: 'spacer' }),
                    el('button', {
                        class: 'btn btn-primary btn-sm', text: 'Aplicar filtros',
                        on: {
                            click: async () => {
                                filtros.estado = estadoSelect.value;
                                filtros.origenId = origenSelect.value;
                                filtros.destinoId = destinoSelect.value;
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
                            el('th', { text: 'Referencia' }),
                            el('th', { text: 'Origen' }),
                            el('th', { text: 'Destino' }),
                            el('th', { text: 'Solicitada' }),
                            el('th', { text: 'Confirmada' }),
                            el('th', { text: 'Solicita' }),
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

        function formularioTransferencia() {
            if (ctx.sucursales.length < 2) {
                toast('Se necesitan al menos dos sucursales para transferir productos.', 'warning');
                return;
            }
            if (productos.length === 0) {
                toast('No hay productos activos para transferir.', 'warning');
                return;
            }

            const origenSelect = select('sucursalOrigenId', ctx.sucursales.map((s) => ({
                value: s.SucursalID,
                label: `${s.CodigoSucursal} · ${s.Nombre}`,
                selected: Number(ctx.sucursalId) === Number(s.SucursalID)
            })), { required: true });

            const destinoSelect = select('sucursalDestinoId', ctx.sucursales.map((s) => ({
                value: s.SucursalID,
                label: `${s.CodigoSucursal} · ${s.Nombre}`
            })), { required: true });

            // Evita que origen y destino coincidan por defecto.
            if (destinoSelect.value === origenSelect.value) {
                const alternativa = [...destinoSelect.options].find((option) => option.value !== origenSelect.value);
                if (alternativa) destinoSelect.value = alternativa.value;
            }

            const hostEditor = el('div');
            let existencias = new Map();
            let editorActual = null;

            function montarEditor() {
                editorActual = new ItemsEditor({ productos, tipo: 'transferencia', existencias });
                clear(hostEditor);
                hostEditor.appendChild(editorActual.element);
            }

            async function cargarExistencias() {
                const origenId = Number(origenSelect.value);
                const response = await api.get('/inventario', { sucursalId: origenId });
                existencias = mapaExistencias(response.datos);
            }

            origenSelect.addEventListener('change', async () => {
                if (origenSelect.value === destinoSelect.value) {
                    const alternativa = [...destinoSelect.options].find(
                        (option) => option.value !== origenSelect.value
                    );
                    if (alternativa) destinoSelect.value = alternativa.value;
                }
                clear(hostEditor);
                hostEditor.appendChild(loading('Cargando existencias del origen…'));
                try {
                    await cargarExistencias();
                    montarEditor();
                } catch (error) {
                    hostEditor.appendChild(el('div', { class: 'info-banner danger' },
                        el('span', { text: error.message })));
                }
            });

            openModal({
                title: 'Nueva transferencia',
                subtitle: 'Al confirmar, el stock se descuenta del origen y se suma al destino.',
                size: 'modal-lg',
                body: el('div', { class: 'stack' },
                    el('div', { class: 'form-grid' },
                        field('Sucursal origen', origenSelect),
                        field('Sucursal destino', destinoSelect),
                        el('div', { class: 'span-2' },
                            field('Código de referencia', input('codigoReferencia', {
                                maxlength: 60, placeholder: 'Se genera automáticamente si se deja vacío'
                            }), 'La solicitud se registra con la fecha y hora actuales.')
                        )
                    ),
                    el('div', { class: 'form-section-title', text: 'Productos a transferir' }),
                    hostEditor,
                    field('Observaciones', textarea('observaciones', {
                        maxlength: 300, rows: 2, placeholder: 'Observaciones opcionales…'
                    }))
                ),
                submitLabel: 'Solicitar transferencia',
                onSubmit: async (data) => {
                    if (Number(data.sucursalOrigenId) === Number(data.sucursalDestinoId)) {
                        throw new Error('La sucursal de origen y destino deben ser diferentes.');
                    }
                    const items = editorActual.obtenerItems();
                    await api.post('/transferencias', {
                        sucursalOrigenId: data.sucursalOrigenId,
                        sucursalDestinoId: data.sucursalDestinoId,
                        codigoReferencia: data.codigoReferencia,
                        observaciones: data.observaciones,
                        items
                    });
                    toast('Transferencia solicitada. Confírmela para mover el inventario.', 'success');
                    await recargar();
                }
            });

            montarEditor();
            cargarExistencias()
                .then(() => montarEditor())
                .catch(() => {});
        }

        async function verDetalle(id) {
            const data = await api.get(`/transferencias/${id}`);
            const transferencia = data.dato;

            const detalle = el('div', { class: 'table-wrap' },
                el('table', { class: 'data' },
                    el('thead', {}, el('tr', {},
                        el('th', { text: 'Producto' }),
                        el('th', { class: 'num', text: 'Cantidad' }),
                        el('th', { class: 'num', text: 'Existencia en origen' })
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
                            el('td', { class: 'num' },
                                formatNumber(linea.ExistenciaOrigen)
                            )
                        ))
                    )
                )
            );

            openModal({
                title: `Transferencia ${transferencia.CodigoReferencia}`,
                subtitle: `${transferencia.SucursalOrigen} → ${transferencia.SucursalDestino}`,
                size: 'modal-lg',
                hideSubmit: true,
                cancelLabel: 'Cerrar',
                body: el('div', { class: 'stack' },
                    el('div', { class: 'detail-grid' },
                        el('div', { class: 'detail' }, el('span', { text: 'Estado' }), estadoBadge(transferencia.Estado)),
                        el('div', { class: 'detail' }, el('span', { text: 'Solicitada' }), el('strong', { text: formatDateTime(transferencia.FechaSolicitud) })),
                        el('div', { class: 'detail' }, el('span', { text: 'Confirmada' }), el('strong', { text: formatDateTime(transferencia.FechaConfirmacion) })),
                        el('div', { class: 'detail' }, el('span', { text: 'Solicita' }), el('strong', { text: transferencia.UsuarioSolicita })),
                        el('div', { class: 'detail' }, el('span', { text: 'Confirma' }), el('strong', { text: transferencia.UsuarioConfirma || '—' }))
                    ),
                    transferencia.Observaciones
                        ? el('div', { class: 'info-banner' }, el('span', { text: transferencia.Observaciones }))
                        : null,
                    detalle
                )
            });
        }

        async function confirmarTransferencia(transferencia) {
            const ok = await confirmDialog({
                title: 'Confirmar transferencia',
                message: `¿Confirma el traslado de ${transferencia.SucursalOrigen} a ${transferencia.SucursalDestino}? El inventario se actualizará en ambas sucursales.`,
                confirmLabel: 'Confirmar transferencia'
            });
            if (!ok) return;

            try {
                await api.post(`/transferencias/${transferencia.TransferenciaID}/confirmar`);
                toast('Transferencia confirmada.', 'success');
                await recargar();
            } catch (error) {
                toast(error.message, 'error');
            }
        }

        async function cancelarTransferencia(transferencia) {
            const ok = await confirmDialog({
                title: 'Cancelar transferencia',
                message: `¿Desea cancelar la transferencia ${transferencia.CodigoReferencia}?`,
                confirmLabel: 'Cancelar transferencia',
                danger: true
            });
            if (!ok) return;

            try {
                await api.post(`/transferencias/${transferencia.TransferenciaID}/cancelar`);
                toast('Transferencia cancelada.', 'success');
                await recargar();
            } catch (error) {
                toast(error.message, 'error');
            }
        }

        renderPagina();
    }
}
