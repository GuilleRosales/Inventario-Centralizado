import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, card, field, input, textarea, select,
    formatMoney, formatNumber, badge, emptyState, loading, openModal, toast, confirmDialog
} from '../../core/ui.js';

function productBody(product, categories) {
    return el('div', { class: 'form-grid' },
        field('Categoría', select('categoriaId', categories.map((c) => ({
            value: c.CategoriaID,
            label: c.Nombre,
            selected: Number(product?.CategoriaID) === Number(c.CategoriaID)
        })), { required: true })),
        field('Código', input('codigo', {
            value: product?.Codigo || '', required: true, maxlength: 40, placeholder: 'LAP-001'
        })),
        field('Nombre', input('nombre', {
            value: product?.Nombre || '', required: true, maxlength: 150
        })),
        field('Marca', input('marca', { value: product?.Marca || '', maxlength: 100 })),
        field('Modelo', input('modelo', { value: product?.Modelo || '', maxlength: 100 })),
        field('Precio de venta (USD)', input('precioVenta', {
            type: 'number', step: '0.01', min: '0', required: true,
            value: product?.PrecioVenta ?? ''
        })),
        field('Stock mínimo', input('stockMinimo', {
            type: 'number', min: '0', value: product?.StockMinimo ?? 0
        })),
        field('Stock máximo', input('stockMaximo', {
            type: 'number', min: '0', value: product?.StockMaximo ?? ''
        })),
        el('div', { class: 'span-2' },
            field('Descripción', textarea('descripcion', {
                maxlength: 500, rows: 2, value: product?.Descripcion || ''
            }))
        ),
        product ? el('label', { class: 'checkbox span-2' },
            el('input', {
                type: 'checkbox', name: 'activo', checked: Boolean(product.Activo)
            }),
            'Producto activo'
        ) : null
    );
}

export class ProductosPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando productos…'));
        const [productosResponse, categoriasResponse] = await Promise.all([
            api.get('/catalogos/productos'),
            api.get('/catalogos/categorias')
        ]);

        const productos = productosResponse.datos;
        const categorias = categoriasResponse.datos;
        const puedeGestionar = ctx.puede('PRODUCTOS.GESTIONAR');

        clear(container);

        container.appendChild(pageHead(
            'Catálogo de productos',
            'Productos informáticos disponibles en todas las sucursales.',
            puedeGestionar
                ? [el('button', {
                    class: 'btn btn-primary', text: '+ Nuevo producto',
                    on: { click: () => abrirFormulario(null) }
                })]
                : []
        ));

        const searchInput = el('input', {
            class: 'input', type: 'search', placeholder: 'Buscar por nombre, código o marca…'
        });
        const categoryFilter = select('categoriaFiltro', [
            { value: '', label: 'Todas las categorías' },
            ...categorias.map((c) => ({ value: c.CategoriaID, label: c.Nombre }))
        ], { class: 'select input-sm', style: { maxWidth: '230px' } });

        const tbody = el('tbody');
        const tableCard = el('section', { class: 'card' },
            el('div', { class: 'toolbar' },
                el('div', { class: 'search' }, searchInput),
                categoryFilter,
                el('span', { class: 'spacer' }),
                el('span', { class: 'muted small', id: 'productos-count' })
            ),
            el('div', { class: 'table-wrap' },
                el('table', { class: 'data' },
                    el('thead', {},
                        el('tr', {},
                            el('th', { text: 'Producto' }),
                            el('th', { text: 'Categoría' }),
                            el('th', { text: 'Marca / modelo' }),
                            el('th', { class: 'num', text: 'Precio' }),
                            el('th', { class: 'num', text: 'Stock mín. / máx.' }),
                            el('th', { class: 'num', text: 'Existencias' }),
                            el('th', { text: 'Estado' }),
                            el('th', { class: 'text-right', text: 'Acciones' })
                        )
                    ),
                    tbody
                )
            )
        );

        container.appendChild(tableCard);

        let filtrados = [...productos];

        function pintarFilas() {
            clear(tbody);
            const texto = searchInput.value.trim().toLowerCase();
            const categoria = categoryFilter.value;
            filtrados = productos.filter((producto) => {
                const coincideTexto = !texto
                    || producto.Nombre.toLowerCase().includes(texto)
                    || producto.Codigo.toLowerCase().includes(texto)
                    || String(producto.Marca || '').toLowerCase().includes(texto);
                const coincideCategoria = !categoria || Number(producto.CategoriaID) === Number(categoria);
                return coincideTexto && coincideCategoria;
            });

            document.getElementById('productos-count').textContent = `${filtrados.length} producto(s)`;

            if (filtrados.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 8 }, emptyState(
                    'Sin productos', 'No se encontraron productos con los filtros seleccionados.'
                ))));
                return;
            }

            for (const producto of filtrados) {
                const stockBajo = Number(producto.ExistenciasTotales) <= Number(producto.StockMinimo);
                const acciones = [];

                if (puedeGestionar) {
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm', text: 'Editar',
                        on: { click: () => abrirFormulario(producto) }
                    }));
                    acciones.push(el('button', {
                        class: 'btn btn-ghost btn-sm',
                        text: producto.Activo ? 'Desactivar' : 'Activar',
                        on: { click: () => cambiarEstado(producto) }
                    }));
                }

                tbody.appendChild(el('tr', {},
                    el('td', {},
                        el('div', { class: 'product-cell' },
                            el('strong', { text: producto.Nombre }),
                            el('small', { text: producto.Codigo })
                        )
                    ),
                    el('td', { text: producto.Categoria }),
                    el('td', { text: [producto.Marca, producto.Modelo].filter(Boolean).join(' · ') || '—' }),
                    el('td', { class: 'num', text: formatMoney(producto.PrecioVenta) }),
                    el('td', { class: 'num', text: `${formatNumber(producto.StockMinimo)} / ${producto.StockMaximo == null ? '—' : formatNumber(producto.StockMaximo)}` }),
                    el('td', { class: 'num' },
                        badge(formatNumber(producto.ExistenciasTotales), stockBajo ? 'warning' : 'neutral')
                    ),
                    el('td', {},
                        producto.Activo
                            ? badge('Activo', 'success')
                            : badge('Inactivo', 'neutral')
                    ),
                    el('td', {},
                        el('div', { class: 'actions-cell' },
                            ...(acciones.length ? acciones : [el('span', { class: 'muted small', text: 'Solo lectura' })])
                        )
                    )
                ));
            }
        }

        function abrirFormulario(producto) {
            openModal({
                title: producto ? 'Editar producto' : 'Nuevo producto',
                subtitle: producto ? producto.Codigo : 'Registre un producto en el catálogo central.',
                body: productBody(producto, categorias),
                submitLabel: producto ? 'Guardar cambios' : 'Crear producto',
                onSubmit: async (data) => {
                    const payload = {
                        categoriaId: data.categoriaId,
                        codigo: data.codigo,
                        nombre: data.nombre,
                        descripcion: data.descripcion,
                        marca: data.marca,
                        modelo: data.modelo,
                        precioVenta: data.precioVenta,
                        stockMinimo: data.stockMinimo || 0,
                        stockMaximo: data.stockMaximo || null,
                        activo: producto ? data.activo === 'on' : true
                    };
                    if (producto) {
                        await api.put(`/catalogos/productos/${producto.ProductoID}`, payload);
                        toast('Producto actualizado.', 'success');
                    } else {
                        await api.post('/catalogos/productos', payload);
                        toast('Producto creado.', 'success');
                    }
                    ctx.refresh();
                }
            });
        }

        async function cambiarEstado(producto) {
            const desactivar = producto.Activo;
            const ok = await confirmDialog({
                title: desactivar ? 'Desactivar producto' : 'Activar producto',
                message: desactivar
                    ? `¿Desea desactivar "${producto.Nombre}"? No se eliminará su historial.`
                    : `¿Desea volver a activar "${producto.Nombre}"?`,
                confirmLabel: desactivar ? 'Desactivar' : 'Activar',
                danger: desactivar
            });
            if (!ok) return;

            await api.put(`/catalogos/productos/${producto.ProductoID}`, {
                categoriaId: producto.CategoriaID,
                codigo: producto.Codigo,
                nombre: producto.Nombre,
                descripcion: producto.Descripcion,
                marca: producto.Marca,
                modelo: producto.Modelo,
                precioVenta: producto.PrecioVenta,
                stockMinimo: producto.StockMinimo,
                stockMaximo: producto.StockMaximo,
                activo: !producto.Activo
            });
            toast(desactivar ? 'Producto desactivado.' : 'Producto activado.', 'success');
            ctx.refresh();
        }

        searchInput.addEventListener('input', pintarFilas);
        categoryFilter.addEventListener('change', pintarFilas);
        pintarFilas();
    }
}
