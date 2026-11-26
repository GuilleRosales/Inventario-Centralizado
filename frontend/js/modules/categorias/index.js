import { api } from '../../core/api.js';
import { BasePage } from '../../core/BasePage.js';
import {
    el, clear, pageHead, field, input, textarea,
    badge, emptyState, loading, openModal, toast, confirmDialog
} from '../../core/ui.js';

export class CategoriasPage extends BasePage {
    async render() {
        return this.montar(this.container, this.ctx);
    }

    async montar(container, ctx) {
        container.appendChild(loading('Cargando categorías…'));
        const response = await api.get('/catalogos/categorias');
        const categorias = response.datos;
        const puedeGestionar = ctx.puede('PRODUCTOS.GESTIONAR');

        clear(container);

        container.appendChild(pageHead(
            'Categorías',
            'Clasificación del catálogo de productos informáticos.',
            puedeGestionar
                ? [el('button', {
                    class: 'btn btn-primary', text: '+ Nueva categoría',
                    on: { click: () => abrirFormulario(null) }
                })]
                : []
        ));

        const tbody = el('tbody');
        container.appendChild(el('section', { class: 'card' },
            el('div', { class: 'table-wrap' },
                el('table', { class: 'data' },
                    el('thead', {},
                        el('tr', {},
                            el('th', { text: 'Categoría' }),
                            el('th', { text: 'Descripción' }),
                            el('th', { class: 'num', text: 'Productos' }),
                            el('th', { text: 'Estado' }),
                            el('th', { class: 'text-right', text: 'Acciones' })
                        )
                    ),
                    tbody
                )
            )
        ));

        function pintar() {
            clear(tbody);
            if (categorias.length === 0) {
                tbody.appendChild(el('tr', {}, el('td', { colspan: 5 }, emptyState(
                    'Sin categorías', 'Registre la primera categoría del catálogo.'
                ))));
                return;
            }

            for (const categoria of categorias) {
                const acciones = puedeGestionar
                    ? [
                        el('button', {
                            class: 'btn btn-ghost btn-sm', text: 'Editar',
                            on: { click: () => abrirFormulario(categoria) }
                        }),
                        el('button', {
                            class: 'btn btn-ghost btn-sm',
                            text: categoria.Activa ? 'Desactivar' : 'Activar',
                            on: { click: () => cambiarEstado(categoria) }
                        })
                    ]
                    : [el('span', { class: 'muted small', text: 'Solo lectura' })];

                tbody.appendChild(el('tr', {},
                    el('td', {}, el('strong', { text: categoria.Nombre })),
                    el('td', { class: 'muted', text: categoria.Descripcion || '—' }),
                    el('td', { class: 'num', text: categoria.Productos }),
                    el('td', {},
                        categoria.Activa ? badge('Activa', 'success') : badge('Inactiva', 'neutral')
                    ),
                    el('td', {},
                        el('div', { class: 'actions-cell' }, ...acciones)
                    )
                ));
            }
        }

        function abrirFormulario(categoria) {
            openModal({
                title: categoria ? 'Editar categoría' : 'Nueva categoría',
                subtitle: categoria ? categoria.Nombre : 'Agrupe productos por tipo o familia.',
                body: el('div', { class: 'form-grid' },
                    field('Nombre', input('nombre', {
                        value: categoria?.Nombre || '', required: true, maxlength: 100
                    })),
                    el('div', { class: 'span-2' },
                        field('Descripción', textarea('descripcion', {
                            maxlength: 300, rows: 2, value: categoria?.Descripcion || ''
                        }))
                    ),
                    categoria ? el('label', { class: 'checkbox span-2' },
                        el('input', {
                            type: 'checkbox', name: 'activo', checked: Boolean(categoria.Activa)
                        }),
                        'Categoría activa'
                    ) : null
                ),
                submitLabel: categoria ? 'Guardar cambios' : 'Crear categoría',
                onSubmit: async (data) => {
                    const payload = {
                        nombre: data.nombre,
                        descripcion: data.descripcion,
                        activa: categoria ? data.activo === 'on' : true
                    };
                    if (categoria) {
                        await api.put(`/catalogos/categorias/${categoria.CategoriaID}`, payload);
                        toast('Categoría actualizada.', 'success');
                    } else {
                        await api.post('/catalogos/categorias', payload);
                        toast('Categoría creada.', 'success');
                    }
                    ctx.refresh();
                }
            });
        }

        async function cambiarEstado(categoria) {
            const desactivar = categoria.Activa;
            const ok = await confirmDialog({
                title: desactivar ? 'Desactivar categoría' : 'Activar categoría',
                message: desactivar
                    ? `¿Desea desactivar "${categoria.Nombre}"? Los productos asociados no se eliminarán.`
                    : `¿Desea activar nuevamente "${categoria.Nombre}"?`,
                confirmLabel: desactivar ? 'Desactivar' : 'Activar',
                danger: desactivar
            });
            if (!ok) return;

            await api.put(`/catalogos/categorias/${categoria.CategoriaID}`, {
                nombre: categoria.Nombre,
                descripcion: categoria.Descripcion,
                activa: !categoria.Activa
            });
            toast(desactivar ? 'Categoría desactivada.' : 'Categoría activada.', 'success');
            ctx.refresh();
        }

        pintar();
    }
}
