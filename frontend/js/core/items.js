/* Editor de líneas de detalle reutilizado por compras, ventas y transferencias. */
import { el, clear, formatMoney } from './ui.js';

/**
 * Editor reutilizable de líneas de detalle.
 * Encapsula las filas, el cálculo del total y la validación de los ítems.
 */
export class ItemsEditor {
    /**
     * @param {object} opciones
     * @param {Array}  opciones.productos   Productos disponibles.
     * @param {string} opciones.tipo        'compra' | 'venta' | 'transferencia'.
     * @param {Map}    [opciones.existencias] Existencias por ProductoID.
     */
    constructor({ productos, tipo = 'compra', existencias = null }) {
        this.productos = productos;
        this.tipo = tipo;
        this.existencias = existencias;
        this.conPrecio = tipo !== 'transferencia';
        this.campoPrecio = tipo === 'compra' ? 'costoUnitario' : 'precioUnitario';
        this.etiquetaPrecio = tipo === 'compra' ? 'Costo unitario' : 'Precio unitario';

        this.filas = el('div', { class: 'items-editor' });
        this.totalTexto = el('strong', { text: formatMoney(0) });

        this.encabezado = this.#crearEncabezado();
        this.filas.appendChild(this.encabezado);

        this.element = el('div', { class: 'stack', style: { gap: '9px' } },
            this.filas,
            el('div', { class: 'items-foot' },
                el('button', {
                    type: 'button',
                    class: 'btn btn-secondary btn-sm',
                    text: '+ Añadir línea',
                    on: { click: () => this.agregarFila() }
                }),
                el('div', { class: 'total-line', style: { padding: '0', border: '0' } },
                    el('span', { text: 'Total' }),
                    this.totalTexto
                )
            )
        );

        this.agregarFila();
    }

    #crearEncabezado() {
        const estilo = this.conPrecio
            ? {}
            : { gridTemplateColumns: 'minmax(0, 1fr) 110px 36px' };

        return el('div', { class: 'item-row items-head', style: estilo },
            el('span', { text: 'Producto' }),
            el('span', { text: 'Cantidad' }),
            this.conPrecio ? el('span', { text: this.etiquetaPrecio }) : null,
            this.conPrecio ? el('span', { class: 'text-right', text: 'Subtotal' }) : null,
            el('span', {})
        );
    }

    #opcionesProducto(seleccionado) {
        return [
            el('option', { value: '', text: 'Seleccione un producto' }),
            ...this.productos.map((producto) => {
                let etiqueta = `${producto.Codigo} · ${producto.Nombre}`;
                if (this.existencias) {
                    const disponible = this.existencias.get(Number(producto.ProductoID)) ?? 0;
                    etiqueta += ` — disp. ${disponible}`;
                }
                return el('option', {
                    value: producto.ProductoID,
                    text: etiqueta,
                    selected: Number(seleccionado) === Number(producto.ProductoID)
                });
            })
        ];
    }

    totalActual() {
        let suma = 0;
        for (const fila of this.filas.children) {
            const cantidad = Number(fila.querySelector('.item-cantidad')?.value) || 0;
            const precio = Number(fila.querySelector('.item-precio')?.value) || 0;
            suma += cantidad * precio;
        }
        return Number(suma.toFixed(2));
    }

    #actualizarTotal() {
        this.totalTexto.textContent = formatMoney(this.totalActual());
    }

    agregarFila(inicial = {}) {
        const productoSelect = el('select', {
            class: 'select input-sm item-producto'
        }, ...this.#opcionesProducto(inicial.productoId));

        const cantidadInput = el('input', {
            class: 'input input-sm item-cantidad',
            type: 'number',
            min: '1',
            step: '1',
            value: inicial.cantidad ?? 1,
            placeholder: 'Cantidad'
        });

        const precioInput = this.conPrecio
            ? el('input', {
                class: 'input input-sm item-precio',
                type: 'number',
                min: '0',
                step: '0.01',
                value: inicial[this.campoPrecio] ?? '',
                placeholder: this.tipo === 'compra' ? 'Costo' : 'Precio'
            })
            : null;

        const subtotal = el('span', {
            class: 'item-subtotal',
            text: formatMoney(
                (Number(inicial.cantidad) || 0) * (Number(inicial[this.campoPrecio]) || 0)
            )
        });

        const fila = el('div', {
            class: 'item-row',
            style: this.conPrecio
                ? {}
                : { gridTemplateColumns: 'minmax(0, 1fr) 110px 36px' }
        },
            productoSelect,
            cantidadInput,
            precioInput,
            this.conPrecio ? subtotal : null,
            el('button', {
                type: 'button',
                class: 'btn btn-ghost btn-icon remove-item',
                title: 'Quitar línea',
                text: '×',
                on: {
                    click: () => {
                        fila.remove();
                        if (this.filas.children.length === 0) this.agregarFila();
                        this.#actualizarTotal();
                    }
                }
            })
        );

        const recalcular = () => {
            const producto = this.productos.find(
                (item) => Number(item.ProductoID) === Number(productoSelect.value)
            );

            if (this.tipo === 'venta' && precioInput && producto && !precioInput.dataset.tocado) {
                precioInput.value = producto.PrecioVenta;
            }

            if (this.existencias && producto) {
                const disponible = this.existencias.get(Number(producto.ProductoID));
                if (disponible !== undefined) cantidadInput.max = String(disponible);
            }

            const sub = (Number(cantidadInput.value) || 0) * (Number(precioInput?.value) || 0);
            subtotal.textContent = formatMoney(sub);
            this.#actualizarTotal();
        };

        productoSelect.addEventListener('change', recalcular);
        cantidadInput.addEventListener('input', recalcular);
        if (precioInput) {
            precioInput.addEventListener('input', () => {
                precioInput.dataset.tocado = '1';
                recalcular();
            });
        }

        this.filas.appendChild(fila);
        this.#actualizarTotal();
        return fila;
    }

    obtenerItems() {
        const items = [];
        const usados = new Set();

        const filas = [...this.filas.children].filter(
            (nodo) => nodo.classList.contains('item-row')
                && !nodo.classList.contains('items-head')
        );

        for (const fila of filas) {
            const productoSelect = fila.querySelector('.item-producto');
            const cantidadInput = fila.querySelector('.item-cantidad');
            const precioInput = fila.querySelector('.item-precio');
            const productoId = Number(productoSelect?.value);

            if (!productoId) {
                throw new Error('Seleccione un producto en todas las líneas.');
            }
            if (usados.has(productoId)) {
                throw new Error('No puede repetir el mismo producto en dos líneas.');
            }
            usados.add(productoId);

            const cantidad = Number(cantidadInput?.value);
            if (!Number.isInteger(cantidad) || cantidad < 1) {
                throw new Error('Cada línea debe tener una cantidad entera mayor que cero.');
            }

            const item = { productoId, cantidad };

            if (this.conPrecio) {
                const precio = Number(precioInput?.value);
                if (!Number.isFinite(precio) || precio < 0) {
                    throw new Error(
                        `Indique un ${this.etiquetaPrecio.toLowerCase()} válido en todas las líneas.`
                    );
                }
                item[this.campoPrecio] = precio;
            }

            items.push(item);
        }

        if (items.length === 0) {
            throw new Error('Debe agregar al menos un producto.');
        }
        return items;
    }

    total() {
        return this.totalActual();
    }

    limpiar() {
        clear(this.filas);
        this.filas.appendChild(this.encabezado);
        this.agregarFila();
    }
}
