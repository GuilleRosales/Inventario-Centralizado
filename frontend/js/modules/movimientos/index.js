import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, input, select,
    formatNumber, formatDateTime, tipoMovimientoBadge,
    emptyState, loading, downloadCsv
} from '../../core/ui.js';

const TIPOS = [
    { value: 'COMPRA', label: 'Compra' },
    { value: 'VENTA', label: 'Venta' },
    { value: 'TRANSFERENCIA_ENTRADA', label: 'Transferencia (entrada)' },
    { value: 'TRANSFERENCIA_SALIDA', label: 'Transferencia (salida)' },
    { value: 'AJUSTE_ENTRADA', label: 'Ajuste (entrada)' },
    { value: 'AJUSTE_SALIDA', label: 'Ajuste (salida)' }
];

function esSalida(tipo) {
    return tipo === 'VENTA' || tipo === 'TRANSFERENCIA_SALIDA' || tipo === 'AJUSTE_SALIDA';
}

function referencia(movimiento) {
    if (movimiento.CompraID) return `Compra #${movimiento.CompraID}`;
    if (movimiento.VentaID) return `Venta #${movimiento.VentaID}`;
    if (movimiento.TransferenciaID) return `Transferencia #${movimiento.TransferenciaID}`;
    return '—';
}

export class MovimientosPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando movimientos…'));

        const filtros = {
            tipo: '',
            desde: '',
            hasta: '',
            busqueda: '',
            limite: 300
        };

        let movimientos = [];

        async function cargar() {
            const response = await api.get('/movimientos', {
                sucursalId: ctx.sucursalId,
                tipo: filtros.tipo,
                desde: filtros.desde,
                hasta: filtros.hasta,
                limite: filtros.limite
            });
            movimientos = response.datos;
        }

        await cargar();
        clear(container);

        const root = el('div');
        container.appendChild(root);

        function filtrados() {
            const texto = filtros.busqueda.trim().toLowerCase();
            if (!texto) return movimientos;
            return movimientos.filter((movimiento) =>
                movimiento.Producto.toLowerCase().includes(texto)
                || movimiento.CodigoProducto.toLowerCase().includes(texto)
                || String(movimiento.UsuarioResponsable || '').toLowerCase().includes(texto)
                || movimiento.Sucursal.toLowerCase().includes(texto)
            );
        }

        function resumen() {
            const datos = filtrados();
            const entradas = datos.filter((m) => !esSalida(m.TipoMovimiento))
                .reduce((sum, m) => sum + Number(m.Cantidad), 0);
            const salidas = datos.filter((m) => esSalida(m.TipoMovimiento))
                .reduce((sum, m) => sum + Number(m.Cantidad), 0);
            return { total: datos.length, entradas, salidas };
        }

        function tabla() {
            const datos = filtrados();
            const tbody = el('tbody');

            if (datos.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 8 }, emptyState(
                    'Sin movimientos',
                    'No hay movimientos registrados con los filtros seleccionados.'
                ))));
            }

            for (const movimiento of datos) {
                const salida = esSalida(movimiento.TipoMovimiento);
                tbody.appendChild(el('tr', {},
                    el('td', { class: 'nowrap small', text: formatDateTime(movimiento.FechaHora) }),
                    el('td', {}, tipoMovimientoBadge(movimiento.TipoMovimiento)),
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('strong', { text: movimiento.Producto }),
                            el('small', { text: movimiento.CodigoProducto })
                        )
                    ),
                    el('td', { class: 'num' },
                        el('span', {
                            class: `badge badge-${salida ? 'danger' : 'success'}`,
                            text: `${salida ? '−' : '+'}${formatNumber(movimiento.Cantidad)}`
                        })
                    ),
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('span', { text: movimiento.Sucursal }),
                            el('small', { text: movimiento.Pais })
                        )
                    ),
                    el('td', { text: movimiento.UsuarioResponsable }),
                    el('td', { class: 'small muted', text: referencia(movimiento) }),
                    el('td', { class: 'muted small', text: movimiento.Observaciones || '—' })
                ));
            }

            return tbody;
        }

        function renderPagina() {
            clear(root);

            root.appendChild(pageHead(
                'Movimientos de inventario',
                'Historial trazable de entradas y salidas generadas por las operaciones.',
                [
                    el('button', {
                        class: 'btn btn-secondary', text: 'Exportar CSV',
                        on: { click: exportar }
                    })
                ]
            ));

            const datos = resumen();

            root.appendChild(el('div', { class: 'stat-grid' },
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon', text: '⇄' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Movimientos listados' }),
                        el('strong', { text: formatNumber(datos.total) })
                    )
                ),
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon green', text: '↧' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Unidades de entrada' }),
                        el('strong', { text: formatNumber(datos.entradas) })
                    )
                ),
                el('div', { class: 'stat-card' },
                    el('div', { class: 'stat-icon amber', text: '↥' }),
                    el('div', { class: 'stat-text' },
                        el('span', { text: 'Unidades de salida' }),
                        el('strong', { text: formatNumber(datos.salidas) })
                    )
                )
            ));

            const tipoSelect = select('tipo', [
                { value: '', label: 'Todos los tipos' },
                ...TIPOS.map((tipo) => ({ value: tipo.value, label: tipo.label }))
            ], { class: 'select input-sm', style: { maxWidth: '230px' } });
            tipoSelect.value = filtros.tipo;

            const desdeInput = el('input', { class: 'input input-sm', type: 'date', value: filtros.desde });
            const hastaInput = el('input', { class: 'input input-sm', type: 'date', value: filtros.hasta });

            const limiteSelect = el('select', { class: 'select input-sm' },
                ...[100, 300, 600, 1000].map((valor) => el('option', {
                    value: valor, text: `${valor} registros`, selected: valor === filtros.limite
                }))
            );

            const buscarInput = el('input', {
                class: 'input', type: 'search',
                placeholder: 'Buscar producto, sucursal o usuario…',
                value: filtros.busqueda
            });

            const tbody = tabla();

            const card = el('section', { class: 'card' },
                el('div', { class: 'toolbar' },
                    el('div', { class: 'search' }, buscarInput),
                    tipoSelect,
                    el('div', { class: 'field-inline' },
                        el('span', { text: 'Desde' }), desdeInput
                    ),
                    el('div', { class: 'field-inline' },
                        el('span', { text: 'Hasta' }), hastaInput
                    ),
                    limiteSelect,
                    el('span', { class: 'spacer' }),
                    el('button', {
                        class: 'btn btn-primary btn-sm', text: 'Aplicar filtros',
                        on: {
                            click: async () => {
                                filtros.tipo = tipoSelect.value;
                                filtros.desde = desdeInput.value;
                                filtros.hasta = hastaInput.value;
                                filtros.limite = Number(limiteSelect.value);
                                await recargar();
                            }
                        }
                    })
                ),
                el('div', { class: 'table-wrap' },
                    el('table', { class: 'data' },
                        el('thead', {}, el('tr', {},
                            el('th', { text: 'Fecha y hora' }),
                            el('th', { text: 'Tipo' }),
                            el('th', { text: 'Producto' }),
                            el('th', { class: 'num', text: 'Cantidad' }),
                            el('th', { text: 'Sucursal' }),
                            el('th', { text: 'Usuario' }),
                            el('th', { text: 'Referencia' }),
                            el('th', { text: 'Observaciones' })
                        )),
                        tbody
                    )
                )
            );

            root.appendChild(card);

            buscarInput.addEventListener('input', () => {
                filtros.busqueda = buscarInput.value;
                repintar();
            });

            async function recargar() {
                try {
                    await cargar();
                    renderPagina();
                } catch (error) {
                    renderPagina();
                }
            }

            function repintar() {
                clear(tbody);
                const nuevas = tabla();
                while (nuevas.firstChild) tbody.appendChild(nuevas.firstChild);
                const totales = resumen();
                const tarjetas = root.querySelectorAll('.stat-card strong');
                if (tarjetas.length >= 3) {
                    tarjetas[0].textContent = formatNumber(totales.total);
                    tarjetas[1].textContent = formatNumber(totales.entradas);
                    tarjetas[2].textContent = formatNumber(totales.salidas);
                }
            }
        }

        function exportar() {
            const datos = filtrados();
            if (datos.length === 0) return;
            downloadCsv(`movimientos-${new Date().toISOString().slice(0, 10)}.csv`, datos, [
                { label: 'Fecha', value: (m) => formatDateTime(m.FechaHora) },
                { label: 'Tipo', value: (m) => m.TipoMovimiento },
                { label: 'Código producto', key: 'CodigoProducto' },
                { label: 'Producto', key: 'Producto' },
                { label: 'Cantidad', key: 'Cantidad' },
                { label: 'Sucursal', key: 'Sucursal' },
                { label: 'País', key: 'Pais' },
                { label: 'Usuario', key: 'UsuarioResponsable' },
                { label: 'Referencia', value: (m) => referencia(m) },
                { label: 'Observaciones', key: 'Observaciones' }
            ]);
        }

        renderPagina();
    }
}
