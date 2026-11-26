import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, tabs, field, input, select, textarea,
    formatNumber, formatDateTime, badge, emptyState, loading,
    openModal, toast, estadoBadge
} from '../../core/ui.js';

function statCard(label, value, hint, tone = '') {
    return el('div', { class: 'stat-card' },
        el('div', { class: `stat-icon ${tone}`, text: '▦' }),
        el('div', { class: 'stat-text' },
            el('span', { text: label }),
            el('strong', { text: formatNumber(value) }),
            hint ? el('small', { text: hint }) : null
        )
    );
}

export class InventarioPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando existencias…'));

        const [inventarioResponse, alertasResponse] = await Promise.all([
            api.get('/inventario', { sucursalId: ctx.sucursalId }),
            api.get('/inventario/alertas')
        ]);

        const registros = inventarioResponse.datos;
        const alertas = alertasResponse.datos;
        const puedeAjustar = ctx.puede('INVENTARIO.AJUSTAR');

        clear(container);

        let activeTab = 'existencias';
        let paisFiltro = '';
        let textoFiltro = '';
        let soloBajoStock = false;

        const root = el('div');
        container.appendChild(root);

        const paises = [...new Set(registros.map((r) => r.Pais))].sort();

        function existenciasFiltradas() {
            const texto = textoFiltro.trim().toLowerCase();
            return registros.filter((registro) => {
                const coincidePais = !paisFiltro || registro.Pais === paisFiltro;
                const coincideTexto = !texto
                    || registro.Producto.toLowerCase().includes(texto)
                    || registro.CodigoProducto.toLowerCase().includes(texto);
                const coincideStock = !soloBajoStock || registro.TieneStockBajo;
                return coincidePais && coincideTexto && coincideStock;
            });
        }

        function resumen() {
            const filtrados = existenciasFiltradas();
            return {
                productos: new Set(filtrados.map((r) => r.ProductoID)).size,
                unidades: filtrados.reduce((sum, r) => sum + Number(r.Cantidad), 0),
                bajoStock: filtrados.filter((r) => r.TieneStockBajo).length,
                agotados: filtrados.filter((r) => Number(r.Cantidad) === 0).length
            };
        }

        function renderResumen() {
            const contenedorResumen = root.querySelector('#resumen-inventario');
            if (!contenedorResumen) return;
            const datos = resumen();
            clear(contenedorResumen);
            contenedorResumen.appendChild(el('div', { class: 'stat-grid' },
                statCard('Productos distintos', datos.productos, 'Según los filtros aplicados'),
                statCard('Unidades en existencia', datos.unidades, 'Suma de cantidades'),
                statCard('Registros bajo stock', datos.bajoStock, 'En o bajo el mínimo', datos.bajoStock ? 'amber' : 'green'),
                statCard('Registros agotados', datos.agotados, 'Cantidad igual a cero', datos.agotados ? 'red' : 'green')
            ));
        }

        function tablaExistencias() {
            const filtrados = existenciasFiltradas();
            const tbody = el('tbody');

            if (filtrados.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 7 }, emptyState(
                    'Sin existencias', 'No hay registros que coincidan con los filtros seleccionados.'
                ))));
            }

            for (const registro of filtrados) {
                const bajo = Boolean(registro.TieneStockBajo);
                const agotado = Number(registro.Cantidad) === 0;

                tbody.appendChild(el('tr', {},
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('strong', { text: registro.Producto }),
                            el('small', { text: `${registro.CodigoProducto} · ${registro.Categoria}` })
                        )
                    ),
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('span', { text: `${registro.CodigoSucursal} · ${registro.Sucursal}` }),
                            el('small', { text: `${registro.Ciudad} · ${registro.Pais}` })
                        )
                    ),
                    el('td', { class: 'num' },
                        agotado
                            ? badge('0', 'danger')
                            : bajo
                                ? badge(formatNumber(registro.Cantidad), 'warning')
                                : badge(formatNumber(registro.Cantidad), 'success')
                    ),
                    el('td', { class: 'num', text: formatNumber(registro.StockMinimoAplicado) }),
                    el('td', { class: 'num', text: registro.StockMaximoAplicado == null ? '—' : formatNumber(registro.StockMaximoAplicado) }),
                    el('td', { class: 'muted small', text: formatDateTime(registro.FechaActualizacion) }),
                    el('td', {},
                        puedeAjustar
                            ? el('div', { class: 'actions-cell' },
                                el('button', {
                                    class: 'btn btn-ghost btn-sm', text: 'Ajustar',
                                    on: { click: () => abrirAjuste(registro) }
                                })
                            )
                            : el('span', { class: 'muted small', text: 'Solo lectura' })
                    )
                ));
            }

            return el('section', { class: 'card' },
                el('div', { class: 'table-wrap' },
                    el('table', { class: 'data' },
                        el('thead', {}, el('tr', {},
                            el('th', { text: 'Producto' }),
                            el('th', { text: 'Sucursal' }),
                            el('th', { class: 'num', text: 'Cantidad' }),
                            el('th', { class: 'num', text: 'Mínimo' }),
                            el('th', { class: 'num', text: 'Máximo' }),
                            el('th', { text: 'Actualizado' }),
                            el('th', { class: 'text-right', text: 'Acciones' })
                        )),
                        tbody
                    )
                )
            );
        }

        function tablaAlertas() {
            const tbody = el('tbody');
            const pendientes = alertas.filter((a) => a.Estado === 'ACTIVA');

            if (alertas.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 8 }, emptyState(
                    'Sin alertas', 'No se han generado alertas de stock mínimo.'
                ))));
            }

            for (const alerta of alertas) {
                tbody.appendChild(el('tr', {},
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('strong', { text: alerta.Producto }),
                            el('small', { text: alerta.CodigoProducto })
                        )
                    ),
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('span', { text: alerta.Sucursal }),
                            el('small', { text: `${alerta.Ciudad} · ${alerta.Pais}` })
                        )
                    ),
                    el('td', { class: 'num', text: formatNumber(alerta.CantidadAlGenerarse) }),
                    el('td', { class: 'num', text: formatNumber(alerta.StockMinimoAlGenerarse) }),
                    el('td', { class: 'muted small', text: formatDateTime(alerta.FechaGeneracion) }),
                    el('td', { class: 'muted small', text: formatDateTime(alerta.FechaAtencion) }),
                    el('td', {}, estadoBadge(alerta.Estado)),
                    el('td', {},
                        alerta.Estado === 'ACTIVA' && puedeAjustar
                            ? el('div', { class: 'actions-cell' },
                                el('button', {
                                    class: 'btn btn-ghost btn-sm', text: 'Atender',
                                    on: { click: () => atenderAlerta(alerta) }
                                })
                            )
                            : el('span', { class: 'muted small', text: '—' })
                    )
                ));
            }

            return el('section', { class: 'card' },
                el('div', { class: 'toolbar' },
                    el('span', { class: 'muted small' },
                        `${pendientes.length} alerta(s) activa(s) de ${alertas.length} en total`),
                    el('span', { class: 'spacer' })
                ),
                el('div', { class: 'table-wrap' },
                    el('table', { class: 'data' },
                        el('thead', {}, el('tr', {},
                            el('th', { text: 'Producto' }),
                            el('th', { text: 'Sucursal' }),
                            el('th', { class: 'num', text: 'Cantidad' }),
                            el('th', { class: 'num', text: 'Mínimo' }),
                            el('th', { text: 'Generada' }),
                            el('th', { text: 'Atendida' }),
                            el('th', { text: 'Estado' }),
                            el('th', { class: 'text-right', text: 'Acciones' })
                        )),
                        tbody
                    )
                )
            );
        }

        function abrirAjuste(registro) {
            openModal({
                title: 'Ajuste de inventario',
                subtitle: `${registro.Producto} · ${registro.Sucursal}`,
                body: el('div', { class: 'stack' },
                    el('div', { class: 'info-banner' },
                        el('span', {},
                            `Existencia actual: ${formatNumber(registro.Cantidad)} unidades. `,
                            'Use cantidades positivas para entradas y negativas para salidas.'
                        )
                    ),
                    el('div', { class: 'form-grid' },
                        field('Cantidad del ajuste', input('cantidadAjuste', {
                            type: 'number', step: '1', required: true,
                            placeholder: 'Ej. 5 o -3'
                        }), 'Debe ser distinto de cero.'),
                        field('Sucursal', input('sucursal', {
                            value: registro.Sucursal, disabled: true
                        }))
                    ),
                    field('Motivo del ajuste', textarea('motivo', {
                        required: true, maxlength: 300, rows: 3,
                        placeholder: 'Describa el motivo del ajuste…'
                    }))
                ),
                submitLabel: 'Registrar ajuste',
                onSubmit: async (data) => {
                    const cantidad = Number(data.cantidadAjuste);
                    if (!Number.isInteger(cantidad) || cantidad === 0) {
                        throw new Error('La cantidad debe ser un número entero distinto de cero.');
                    }

                    await api.post('/inventario/ajuste', {
                        productoId: registro.ProductoID,
                        sucursalId: registro.SucursalID,
                        cantidadAjuste: cantidad,
                        motivo: data.motivo
                    });
                    toast('Ajuste registrado correctamente.', 'success');
                    ctx.refresh();
                }
            });
        }

        async function atenderAlerta(alerta) {
            try {
                await api.post(`/inventario/alertas/${alerta.AlertaID}/atender`);
                toast('Alerta marcada como atendida.', 'success');
                ctx.refresh();
            } catch (error) {
                toast(error.message || 'No se pudo atender la alerta.', 'error');
            }
        }

        function renderPagina() {
            clear(root);

            root.appendChild(pageHead(
                'Control de existencias',
                'Stock disponible por producto y sucursal, con alertas de reposición.',
                [
                    el('button', {
                        class: 'btn btn-secondary',
                        text: 'Actualizar',
                        on: { click: () => ctx.refresh() }
                    })
                ]
            ));

            root.appendChild(el('div', { id: 'resumen-inventario' }));

            root.appendChild(tabs([
                { key: 'existencias', label: 'Existencias' },
                { key: 'alertas', label: `Alertas (${alertas.filter((a) => a.Estado === 'ACTIVA').length})` }
            ], activeTab, (key) => {
                activeTab = key;
                renderPagina();
            }));

            if (activeTab === 'existencias') {
                const paisSelect = select('paisFiltro', [
                    { value: '', label: 'Todos los países' },
                    ...paises.map((pais) => ({ value: pais, label: pais }))
                ], { class: 'select input-sm', style: { maxWidth: '220px' } });
                paisSelect.value = paisFiltro;

                const buscarInput = el('input', {
                    class: 'input', type: 'search',
                    placeholder: 'Buscar producto o código…',
                    value: textoFiltro
                });

                const bajoCheck = el('input', {
                    type: 'checkbox', checked: soloBajoStock
                });

                const contenido = el('div');
                const toolbar = el('div', { class: 'toolbar' },
                    el('div', { class: 'search' }, buscarInput),
                    paisSelect,
                    el('label', { class: 'checkbox' }, bajoCheck, 'Solo bajo stock'),
                    el('span', { class: 'spacer' }),
                    el('span', { class: 'muted small' })
                );

                function refrescarTabla() {
                    clear(contenido);
                    contenido.appendChild(tablaExistencias());
                    renderResumen();
                }

                buscarInput.addEventListener('input', () => {
                    textoFiltro = buscarInput.value;
                    refrescarTabla();
                });
                paisSelect.addEventListener('change', () => {
                    paisFiltro = paisSelect.value;
                    refrescarTabla();
                });
                bajoCheck.addEventListener('change', () => {
                    soloBajoStock = bajoCheck.checked;
                    refrescarTabla();
                });

                const seccion = el('section', { class: 'card' }, toolbar, contenido);
                root.appendChild(seccion);
                refrescarTabla();
            } else {
                root.appendChild(tablaAlertas());
                renderResumen();
            }
        }

        renderPagina();
    }
}
