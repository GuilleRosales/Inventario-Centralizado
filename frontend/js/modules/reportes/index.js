import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, tabs, select,
    formatMoney, formatNumber, formatDateTime, estadoBadge,
    emptyState, loading, downloadCsv
} from '../../core/ui.js';

const TABS = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'compras', label: 'Compras' },
    { key: 'transferencias', label: 'Transferencias' },
    { key: 'inventario', label: 'Inventario valorado' }
];

export class ReportesPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando reportes…'));

        const categoriasResponse = await api.get('/catalogos/categorias');
        const categorias = categoriasResponse.datos;

        const filtros = {
            tab: 'ventas',
            desde: '',
            hasta: '',
            categoria: '',
            sucursalId: ctx.sucursalId || ''
        };

        let datos = [];

        async function cargar() {
            const params = {
                desde: filtros.desde,
                hasta: filtros.hasta,
                categoria: filtros.tab === 'transferencias' ? '' : filtros.categoria,
                sucursalId: filtros.sucursalId
            };

            const rutas = {
                ventas: '/reportes/ventas',
                compras: '/reportes/compras',
                transferencias: '/reportes/transferencias',
                inventario: '/reportes/inventario-valorado'
            };

            const response = await api.get(rutas[filtros.tab], params);
            datos = response.datos;
        }

        await cargar();
        clear(container);

        const root = el('div');
        container.appendChild(root);

        function resumen() {
            if (filtros.tab === 'inventario') {
                return [
                    { etiqueta: 'Líneas de inventario', valor: formatNumber(datos.length) },
                    { etiqueta: 'Unidades en existencia', valor: formatNumber(datos.reduce((s, d) => s + Number(d.Cantidad), 0)) },
                    { etiqueta: 'Valor del inventario', valor: formatMoney(datos.reduce((s, d) => s + Number(d.ValorInventario), 0)) }
                ];
            }

            if (filtros.tab === 'transferencias') {
                return [
                    { etiqueta: 'Líneas transferidas', valor: formatNumber(datos.length) },
                    { etiqueta: 'Transferencias distintas', valor: formatNumber(new Set(datos.map((d) => d.TransferenciaID)).size) },
                    { etiqueta: 'Unidades transferidas', valor: formatNumber(datos.reduce((s, d) => s + Number(d.Cantidad), 0)) }
                ];
            }

            if (filtros.tab === 'compras') {
                return [
                    { etiqueta: 'Líneas de compra', valor: formatNumber(datos.length) },
                    { etiqueta: 'Unidades compradas', valor: formatNumber(datos.reduce((s, d) => s + Number(d.Cantidad), 0)) },
                    { etiqueta: 'Monto comprado', valor: formatMoney(datos.reduce((s, d) => s + Number(d.Subtotal), 0)) }
                ];
            }

            return [
                { etiqueta: 'Líneas de venta', valor: formatNumber(datos.length) },
                { etiqueta: 'Unidades vendidas', valor: formatNumber(datos.reduce((s, d) => s + Number(d.Cantidad), 0)) },
                { etiqueta: 'Monto vendido', valor: formatMoney(datos.reduce((s, d) => s + Number(d.Subtotal), 0)) }
            ];
        }

        function columnas() {
            if (filtros.tab === 'compras') {
                return ['Factura', 'Proveedor', 'Sucursal', 'Fecha', 'Producto', 'Categoría', 'Cantidad', 'Costo', 'Subtotal'];
            }
            if (filtros.tab === 'transferencias') {
                return ['Referencia', 'Origen', 'Destino', 'Solicitada', 'Producto', 'Cantidad', 'Estado'];
            }
            if (filtros.tab === 'inventario') {
                return ['País', 'Sucursal', 'Categoría', 'Producto', 'Cantidad', 'Precio', 'Valor'];
            }
            return ['Comprobante', 'Cliente', 'Sucursal', 'Fecha', 'Producto', 'Categoría', 'Cantidad', 'Precio', 'Subtotal'];
        }

        function fila(dato) {
            if (filtros.tab === 'compras') {
                return [
                    dato.NumeroFactura,
                    dato.Proveedor,
                    dato.SucursalDestino,
                    formatDateTime(dato.FechaCompra),
                    `${dato.CodigoProducto} · ${dato.Producto}`,
                    dato.Categoria,
                    formatNumber(dato.Cantidad),
                    formatMoney(dato.CostoUnitario),
                    formatMoney(dato.Subtotal)
                ];
            }
            if (filtros.tab === 'transferencias') {
                return [
                    dato.CodigoReferencia,
                    dato.SucursalOrigen,
                    dato.SucursalDestino,
                    formatDateTime(dato.FechaSolicitud),
                    `${dato.CodigoProducto} · ${dato.Producto}`,
                    formatNumber(dato.Cantidad),
                    dato.Estado
                ];
            }
            if (filtros.tab === 'inventario') {
                return [
                    dato.Pais,
                    dato.Sucursal,
                    dato.Categoria,
                    `${dato.CodigoProducto} · ${dato.Producto}`,
                    formatNumber(dato.Cantidad),
                    formatMoney(dato.PrecioVenta),
                    formatMoney(dato.ValorInventario)
                ];
            }
            return [
                dato.NumeroComprobante,
                dato.Cliente || 'Consumidor final',
                dato.Sucursal,
                formatDateTime(dato.FechaVenta),
                `${dato.CodigoProducto} · ${dato.Producto}`,
                dato.Categoria,
                formatNumber(dato.Cantidad),
                formatMoney(dato.PrecioUnitario),
                formatMoney(dato.Subtotal)
            ];
        }

        function tabla() {
            const tbody = el('tbody');

            if (datos.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: columnas().length }, emptyState(
                    'Sin información',
                    'No hay datos para los filtros seleccionados.'
                ))));
            }

            for (const dato of datos) {
                const valores = fila(dato);
                tbody.appendChild(el('tr', {},
                    ...valores.map((valor, indice) => {
                        if (filtros.tab === 'transferencias' && indice === valores.length - 1) {
                            return el('td', {}, estadoBadge(dato.Estado));
                        }
                        const numerica = typeof valor === 'string'
                            && (valor.startsWith('$') || /^\d[\d,]*$/.test(valor));
                        return el('td', {
                            class: numerica ? 'num' : (indice >= 6 ? 'num' : ''),
                            text: valor
                        });
                    })
                ));
            }

            return el('div', { class: 'table-wrap' },
                el('table', { class: 'data' },
                    el('thead', {}, el('tr', {},
                        ...columnas().map((columna, indice) => el('th', {
                            class: indice >= 6 ? 'num' : '',
                            text: columna
                        }))
                    )),
                    tbody
                )
            );
        }

        function renderPagina() {
            clear(root);

            root.appendChild(pageHead(
                'Reportes consolidados',
                'Información de ventas, compras, transferencias e inventario valorado.',
                [el('button', {
                    class: 'btn btn-secondary', text: 'Exportar CSV',
                    on: { click: exportar }
                })]
            ));

            root.appendChild(el('div', { class: 'stat-grid' },
                ...resumen().map((item) => el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon', text: '⌁' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: item.etiqueta }),
                        el('strong', { text: item.valor })
                    )
                ))
            ));

            root.appendChild(tabs(TABS, filtros.tab, async (key) => {
                filtros.tab = key;
                filtros.categoria = '';
                await recargar();
            }));

            const desdeInput = el('input', { class: 'input input-sm', type: 'date', value: filtros.desde });
            const hastaInput = el('input', { class: 'input input-sm', type: 'date', value: filtros.hasta });

            const sucursalSelect = select('sucursalId', [
                { value: '', label: 'Todas las sucursales' },
                ...ctx.sucursales.map((s) => ({
                    value: s.SucursalID,
                    label: `${s.CodigoSucursal} · ${s.Nombre}`
                }))
            ], { class: 'select input-sm', style: { maxWidth: '230px' } });
            sucursalSelect.value = filtros.sucursalId;

            const categoriaSelect = select('categoria', [
                { value: '', label: 'Todas las categorías' },
                ...categorias.map((c) => ({ value: c.Nombre, label: c.Nombre }))
            ], { class: 'select input-sm', style: { maxWidth: '210px' } });
            categoriaSelect.value = filtros.categoria;
            categoriaSelect.disabled = filtros.tab === 'transferencias';

            root.appendChild(el('section', { class: 'card' },
                el('div', { class: 'toolbar' },
                    el('div', { class: 'field-inline' }, el('span', { text: 'Desde' }), desdeInput),
                    el('div', { class: 'field-inline' }, el('span', { text: 'Hasta' }), hastaInput),
                    sucursalSelect,
                    categoriaSelect,
                    el('span', { class: 'spacer' }),
                    el('button', {
                        class: 'btn btn-primary btn-sm', text: 'Aplicar filtros',
                        on: {
                            click: async () => {
                                filtros.desde = desdeInput.value;
                                filtros.hasta = hastaInput.value;
                                filtros.sucursalId = sucursalSelect.value;
                                filtros.categoria = categoriaSelect.value;
                                await recargar();
                            }
                        }
                    }),
                    el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Limpiar',
                        on: {
                            click: async () => {
                                filtros.desde = '';
                                filtros.hasta = '';
                                filtros.categoria = '';
                                await recargar();
                            }
                        }
                    })
                ),
                tabla()
            ));
        }

        async function recargar() {
            try {
                await cargar();
            } finally {
                renderPagina();
            }
        }

        function exportar() {
            if (datos.length === 0) return;

            const columnasCsv = columnas().map((label) => ({
                label,
                value: (dato) => fila(dato)[columnas().indexOf(label)]
            }));

            downloadCsv(`reporte-${filtros.tab}-${new Date().toISOString().slice(0, 10)}.csv`, datos, columnasCsv);
        }

        renderPagina();
    }
}
