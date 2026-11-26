import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, card, formatMoney, formatNumber, formatDateTime,
    estadoBadge, tipoMovimientoBadge, emptyState, loading
} from '../../core/ui.js';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function periodLabel(periodo) {
    const [year, month] = String(periodo).split('-');
    return `${MESES[Number(month) - 1] || month} ${String(year).slice(2)}`;
}

function statCard(icon, tone, label, value, hint) {
    return el('div', { class: 'stat-card' },
        el('div', { class: `stat-icon ${tone}`, text: icon }),
        el('div', { class: 'stat-text' },
            el('span', { text: label }),
            el('strong', { text: value }),
            hint ? el('small', { text: hint }) : null
        )
    );
}

export class PanelPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando panel de control…'));
        const data = await api.get('/dashboard');
        const resumen = data.resumen || {};
        clear(container);

        container.appendChild(pageHead(
            `Hola, ${String(ctx.user.nombre).split(' ')[0]}`,
            'Este es el estado actual del inventario centralizado.'
        ));

        container.appendChild(el('div', { class: 'stat-grid' },
            statCard('▦', '', 'Productos activos', formatNumber(resumen.Productos), 'En el catálogo'),
            statCard('⌂', 'green', 'Sucursales activas', formatNumber(resumen.Sucursales), 'En operación'),
            statCard('▤', '', 'Existencias totales', formatNumber(resumen.Existencias), 'Unidades en todas las sucursales'),
            statCard('!', resumen.AlertasActivas > 0 ? 'red' : 'green', 'Alertas activas',
                formatNumber(resumen.AlertasActivas), 'Productos en o bajo el mínimo')
        ));

        container.appendChild(el('div', { class: 'stat-grid' },
            statCard('$', 'green', 'Ventas del último mes', formatMoney(resumen.VentasMes), 'Ventas confirmadas'),
            statCard('↧', '', 'Compras del último mes', formatMoney(resumen.ComprasMes), 'Compras recibidas')
        ));

        const maxVentas = Math.max(...(data.ventasPorMes || []).map((v) => Number(v.Total)), 1);

        const chart = el('div', { class: 'bar-chart' },
            ...(data.ventasPorMes?.length
                ? data.ventasPorMes.map((item) => el('div', { class: 'bar-col' },
                    el('b', { text: formatMoney(item.Total) }),
                    el('div', { class: 'bar-track' },
                        el('div', {
                            class: 'bar-fill',
                            style: { height: `${Math.max(4, (Number(item.Total) / maxVentas) * 100)}%` }
                        })
                    ),
                    el('span', { text: periodLabel(item.Periodo) })
                ))
                : [emptyState('Sin ventas confirmadas', 'Las ventas confirmadas aparecerán aquí.')]
            )
        );

        const maxExistencia = Math.max(...(data.porSucursal || []).map((s) => Number(s.Existencias)), 1);
        const sucursalesList = el('div', { class: 'list' },
            ...(data.porSucursal?.length
                ? data.porSucursal.map((sucursal) => el('div', { class: 'list-item' },
                    el('div', { class: 'grow' },
                        el('strong', { text: sucursal.Sucursal }),
                        el('small', { text: sucursal.Pais }),
                        el('div', { class: 'mini-bar' },
                            el('span', {
                                style: { width: `${Math.max(3, (Number(sucursal.Existencias) / maxExistencia) * 100)}%` }
                            })
                        )
                    ),
                    el('span', { class: 'amount', text: formatNumber(sucursal.Existencias) })
                ))
                : [emptyState('Sin sucursales', 'Registre sucursales para ver la distribución.')]
            )
        );

        const bajoStockTable = el('div', { class: 'table-wrap' },
            el('table', { class: 'data' },
                el('thead', {},
                    el('tr', {},
                        el('th', { text: 'Producto' }),
                        el('th', { text: 'Sucursal' }),
                        el('th', { class: 'num', text: 'Cantidad' }),
                        el('th', { class: 'num', text: 'Mínimo' })
                    )
                ),
                el('tbody', {},
                    ...(data.bajoStock?.length
                        ? data.bajoStock.map((item) => el('tr', {},
                            el('td', {},
                                el('div', { class: 'product-cell' },
                                    el('strong', { text: item.Producto }),
                                    el('small', { text: item.CodigoProducto })
                                )
                            ),
                            el('td', {},
                                el('div', { class: 'product-cell' },
                                    el('span', { text: item.Sucursal }),
                                    el('small', { text: item.Pais })
                                )
                            ),
                            el('td', { class: 'num' },
                                Number(item.Cantidad) === 0
                                    ? el('span', { class: 'badge badge-danger', text: '0' })
                                    : el('span', { class: 'badge badge-warning', text: formatNumber(item.Cantidad) })
                            ),
                            el('td', { class: 'num', text: formatNumber(item.StockMinimoAplicado) })
                        ))
                        : [el('tr', {}, el('td', { colspan: 4 }, emptyState('Sin alertas', 'No hay productos bajo el stock mínimo.')))])
                )
            )
        );

        const movimientosList = el('div', { class: 'list' },
            ...(data.movimientos?.length
                ? data.movimientos.map((movimiento) => el('div', { class: 'list-item' },
                    el('div', { class: 'grow' },
                        el('strong', { text: movimiento.Producto }),
                        el('small', { text: `${movimiento.Sucursal} · ${formatDateTime(movimiento.FechaHora)}` })
                    ),
                    el('div', { class: 'row' },
                        tipoMovimientoBadge(movimiento.TipoMovimiento),
                        el('span', { class: 'amount', text: formatNumber(movimiento.Cantidad) })
                    )
                ))
                : [emptyState('Sin movimientos', 'Los movimientos de inventario aparecerán aquí.')]
            )
        );

        container.appendChild(el('div', { class: 'dashboard-grid' },
            card('Ventas de los últimos meses', 'Montos confirmados por periodo', chart),
            card('Existencias por sucursal', 'Distribución actual del stock', sucursalesList),
            card('Productos bajo stock', 'Requieren reposición', bajoStockTable,
                [el('a', { class: 'btn btn-ghost btn-sm', href: '#/inventario', text: 'Ver inventario' })]),
            card('Movimientos recientes', 'Últimas operaciones registradas', movimientosList,
                [el('a', { class: 'btn btn-ghost btn-sm', href: '#/movimientos', text: 'Ver historial' })])
        ));
    }
}
