import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, field, input, select, textarea,
    formatMoney, formatNumber, formatDateTime, estadoBadge,
    emptyState, loading, openModal, toast, confirmDialog
} from '../../core/ui.js';
import { ItemsEditor } from '../../core/items.js';

function sucursalOptions(sucursales, selected = '') {
    return [
        { value: '', label: 'Todas las sucursales' },
        ...sucursales.map((s) => ({
            value: s.SucursalID,
            label: `${s.CodigoSucursal} · ${s.Nombre}`,
            selected: Number(selected) === Number(s.SucursalID)
        }))
    ];
}

export class ComprasPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando compras…'));

        const filtros = {
            estado: '',
            proveedorId: '',
            desde: '',
            hasta: ''
        };

        let compras = [];
        let proveedores = [];
        let productos = [];

        const puedeRegistrar = ctx.puede('COMPRAS.REGISTRAR');

        async function cargarTodo() {
            const [comprasResponse, proveedoresResponse, productosResponse] = await Promise.all([
                api.get('/compras', {
                    estado: filtros.estado,
                    proveedorId: filtros.proveedorId,
                    desde: filtros.desde,
                    hasta: filtros.hasta,
                    sucursalId: ctx.sucursalId
                }),
                api.get('/catalogos/proveedores'),
                api.get('/catalogos/productos')
            ]);
            compras = comprasResponse.datos;
            proveedores = proveedoresResponse.datos;
            productos = productosResponse.datos;
        }

        await cargarTodo();
        clear(container);

        const root = el('div');
        container.appendChild(root);

        function renderPagina() {
            clear(root);

            root.appendChild(pageHead(
                'Compras a proveedores',
                'Registre las compras y confirme su recepción para actualizar existencias.',
                puedeRegistrar
                    ? [
                        el('button', {
                            class: 'btn btn-secondary', text: '+ Nuevo proveedor',
                            on: { click: () => formularioProveedor() }
                        }),
                        el('button', {
                            class: 'btn btn-primary', text: '+ Nueva compra',
                            on: { click: () => formularioCompra() }
                        })
                    ]
                    : []
            ));

            const registradas = compras.filter((c) => c.Estado === 'REGISTRADA');
            const recibidas = compras.filter((c) => c.Estado === 'RECIBIDA');
            const totalRecibido = recibidas.reduce((sum, c) => sum + Number(c.TotalCompra), 0);

            root.appendChild(el('div', { class: 'stat-grid' },
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon', text: '▤' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Compras listadas' }),
                        el('strong', { text: formatNumber(compras.length) })
                    )
                ),
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon amber', text: '⌛' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Pendientes de recibir' }),
                        el('strong', { text: formatNumber(registradas.length) })
                    )
                ),
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon green', text: '$' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Monto recibido' }),
                        el('strong', { text: formatMoney(totalRecibido) })
                    )
                )
            ));

            const estadoSelect = select('estado', [
                { value: '', label: 'Todos los estados' },
                { value: 'REGISTRADA', label: 'Registrada' },
                { value: 'RECIBIDA', label: 'Recibida' },
                { value: 'CANCELADA', label: 'Cancelada' }
            ], { class: 'select input-sm', style: { maxWidth: '190px' } });
            estadoSelect.value = filtros.estado;

            const proveedorSelect = select('proveedorId', [
                { value: '', label: 'Todos los proveedores' },
                ...proveedores.map((p) => ({ value: p.ProveedorID, label: p.NombreEmpresa }))
            ], { class: 'select input-sm', style: { maxWidth: '250px' } });
            proveedorSelect.value = filtros.proveedorId;

            const desdeInput = el('input', { class: 'input input-sm', type: 'date', value: filtros.desde });
            const hastaInput = el('input', { class: 'input input-sm', type: 'date', value: filtros.hasta });

            const tbody = el('tbody');

            if (compras.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 8 }, emptyState(
                    'Sin compras', 'Registre la primera compra a un proveedor.'
                ))));
            }

            for (const compra of compras) {
                const acciones = [
                    el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Ver',
                        on: { click: () => verDetalle(compra.CompraID) }
                    })
                ];

                if (puedeRegistrar && compra.Estado === 'REGISTRADA') {
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Recibir',
                        on: { click: () => confirmarCompra(compra) }
                    }));
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Cancelar',
                        on: { click: () => cancelarCompra(compra) }
                    }));
                }

                tbody.appendChild(el('tr', {},
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('strong', { text: compra.NumeroFactura }),
                            el('small', { text: `#${compra.CompraID} · ${compra.Lineas} línea(s)` })
                        )
                    ),
                    el('td', { text: compra.Proveedor }),
                    el('td', { text: compra.Sucursal }),
                    el('td', { class: 'small', text: formatDateTime(compra.FechaCompra) }),
                    el('td', { class: 'muted small', text: formatDateTime(compra.FechaRecepcion) }),
                    el('td', { class: 'num', text: formatMoney(compra.TotalCompra) }),
                    el('td', {}, estadoBadge(compra.Estado)),
                    el('td', {}, el('div', { class: 'actions-cell' }, ...acciones))
                ));
            }

            root.appendChild(el('section', { class: 'card' },
                el('div', { class: 'toolbar' },
                    estadoSelect,
                    proveedorSelect,
                    el('div', { class: 'field-inline' }, el('span', { text: 'Desde' }), desdeInput),
                    el('div', { class: 'field-inline' }, el('span', { text: 'Hasta' }), hastaInput),
                    el('span', { class: 'spacer' }),
                    el('button', {
                        class: 'btn btn-primary btn-sm', text: 'Aplicar filtros',
                        on: {
                            click: async () => {
                                filtros.estado = estadoSelect.value;
                                filtros.proveedorId = proveedorSelect.value;
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
                            el('th', { text: 'Factura' }),
                            el('th', { text: 'Proveedor' }),
                            el('th', { text: 'Sucursal destino' }),
                            el('th', { text: 'Fecha de compra' }),
                            el('th', { text: 'Recepción' }),
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

        function formularioCompra() {
            if (proveedores.length === 0) {
                toast('Registre al menos un proveedor antes de crear una compra.', 'warning');
                return;
            }
            if (productos.length === 0) {
                toast('No hay productos activos para comprar.', 'warning');
                return;
            }

            const sucursales = ctx.sucursales.length
                ? ctx.sucursales
                : [{ SucursalID: 1, CodigoSucursal: 'SUC', Nombre: 'Sucursal principal' }];

            const proveedorSelect = select('proveedorId', proveedores.map((p) => ({
                value: p.ProveedorID, label: p.NombreEmpresa
            })), { required: true });

            const sucursalSelect = select('sucursalDestinoId', sucursales.map((s) => ({
                value: s.SucursalID,
                label: `${s.CodigoSucursal} · ${s.Nombre}`,
                selected: Number(ctx.sucursalId) === Number(s.SucursalID)
            })), { required: true });

            const editor = new ItemsEditor({ productos, tipo: 'compra' });

            openModal({
                title: 'Nueva compra',
                subtitle: 'Registre la factura del proveedor y las líneas de productos.',
                size: 'modal-lg',
                body: el('div', { class: 'stack' },
                    el('div', { class: 'form-grid' },
                        field('Proveedor', proveedorSelect),
                        field('Sucursal destino', sucursalSelect),
                        el('div', { class: 'span-2' },
                            field('Número de factura', input('numeroFactura', {
                                required: true, maxlength: 60, placeholder: 'FAC-2026-001'
                            }), 'La compra se registra con la fecha y hora actuales.')
                        )
                    ),
                    el('div', { class: 'form-section-title', text: 'Detalle de productos' }),
                    editor.element,
                    field('Observaciones', textarea('observaciones', {
                        maxlength: 300, rows: 2, placeholder: 'Observaciones opcionales…'
                    }))
                ),
                submitLabel: 'Registrar compra',
                onSubmit: async (data) => {
                    const items = editor.obtenerItems();
                    await api.post('/compras', {
                        proveedorId: data.proveedorId,
                        sucursalDestinoId: data.sucursalDestinoId,
                        numeroFactura: data.numeroFactura,
                        observaciones: data.observaciones,
                        items
                    });
                    toast('Compra registrada. Confirme la recepción para actualizar el stock.', 'success');
                    await recargar();
                }
            });
        }

        function formularioProveedor() {
            openModal({
                title: 'Nuevo proveedor',
                subtitle: 'La compra quedará asociada a este proveedor.',
                body: el('div', { class: 'form-grid' },
                    field('Nombre de la empresa', input('nombreEmpresa', {
                        required: true, maxlength: 160
                    })),
                    field('Identificación fiscal', input('numeroIdentificacion', { maxlength: 40 })),
                    field('Teléfono', input('telefono', { maxlength: 30 })),
                    field('Correo', input('correo', { type: 'email', maxlength: 150 })),
                    el('div', { class: 'span-2' },
                        field('Dirección', input('direccion', { maxlength: 250 }))
                    )
                ),
                submitLabel: 'Crear proveedor',
                onSubmit: async (data) => {
                    await api.post('/catalogos/proveedores', data);
                    toast('Proveedor creado.', 'success');
                    await recargar();
                }
            });
        }

        async function verDetalle(id) {
            const data = await api.get(`/compras/${id}`);
            const compra = data.dato;

            const detalle = el('div', { class: 'table-wrap' },
                el('table', { class: 'data' },
                    el('thead', {}, el('tr', {},
                        el('th', { text: 'Producto' }),
                        el('th', { class: 'num', text: 'Cantidad' }),
                        el('th', { class: 'num', text: 'Costo unitario' }),
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
                            el('td', { class: 'num', text: formatMoney(linea.CostoUnitario) }),
                            el('td', { class: 'num', text: formatMoney(linea.Subtotal) })
                        ))
                    )
                )
            );

            openModal({
                title: `Compra ${compra.NumeroFactura}`,
                subtitle: `Registrada por ${compra.UsuarioRegistro}`,
                size: 'modal-lg',
                hideSubmit: true,
                cancelLabel: 'Cerrar',
                body: el('div', { class: 'stack' },
                    el('div', { class: 'detail-grid' },
                        el('div', { class: 'detail' }, el('span', { text: 'Proveedor' }), el('strong', { text: compra.Proveedor })),
                        el('div', { class: 'detail' }, el('span', { text: 'Sucursal destino' }), el('strong', { text: compra.Sucursal })),
                        el('div', { class: 'detail' }, el('span', { text: 'Estado' }), estadoBadge(compra.Estado)),
                        el('div', { class: 'detail' }, el('span', { text: 'Fecha de compra' }), el('strong', { text: formatDateTime(compra.FechaCompra) })),
                        el('div', { class: 'detail' }, el('span', { text: 'Fecha de recepción' }), el('strong', { text: formatDateTime(compra.FechaRecepcion) })),
                        el('div', { class: 'detail' }, el('span', { text: 'Recibida por' }), el('strong', { text: compra.UsuarioRecepcion || '—' }))
                    ),
                    compra.Observaciones
                        ? el('div', { class: 'info-banner' }, el('span', { text: compra.Observaciones }))
                        : null,
                    detalle,
                    el('div', { class: 'total-line' }, el('span', { text: 'Total de la compra' }), el('strong', { text: formatMoney(compra.TotalCompra) }))
                )
            });
        }

        async function confirmarCompra(compra) {
            const ok = await confirmDialog({
                title: 'Recibir compra',
                message: `¿Confirma la recepción de la factura ${compra.NumeroFactura}? Las existencias de ${compra.Sucursal} se incrementarán.`,
                confirmLabel: 'Recibir compra'
            });
            if (!ok) return;

            try {
                await api.post(`/compras/${compra.CompraID}/confirmar`);
                toast('Compra recibida y existencias actualizadas.', 'success');
                await recargar();
            } catch (error) {
                toast(error.message, 'error');
            }
        }

        async function cancelarCompra(compra) {
            const ok = await confirmDialog({
                title: 'Cancelar compra',
                message: `¿Desea cancelar la compra ${compra.NumeroFactura}? Esta acción no modifica el inventario.`,
                confirmLabel: 'Cancelar compra',
                danger: true
            });
            if (!ok) return;

            try {
                await api.post(`/compras/${compra.CompraID}/cancelar`);
                toast('Compra cancelada.', 'success');
                await recargar();
            } catch (error) {
                toast(error.message, 'error');
            }
        }

        renderPagina();
    }
}
