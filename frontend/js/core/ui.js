/* Clase de utilidades de interfaz: nodos, modales, avisos y formatos. */

export class UI {
    static el(tag, attrs = {}, ...children) {
        const node = document.createElement(tag);

        for (const [key, value] of Object.entries(attrs || {})) {
            if (value === null || value === undefined || value === false) continue;
            if (key === 'class') node.className = value;
            else if (key === 'text') node.textContent = value;
            else if (key === 'html') node.innerHTML = value;
            else if (key === 'for') node.htmlFor = value;
            else if (key === 'colspan') node.colSpan = value;
            else if (key === 'dataset') Object.assign(node.dataset, value);
            else if (key === 'on') {
                for (const [event, handler] of Object.entries(value)) {
                    node.addEventListener(event, handler);
                }
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(node.style, value);
            } else if (key in node && key !== 'list') {
                try {
                    node[key] = value;
                } catch (_) {
                    node.setAttribute(key, value);
                }
            } else {
                node.setAttribute(key, value);
            }
        }

        UI.append(node, children);
        return node;
    }

    static append(parent, children) {
        for (const child of children.flat(Infinity)) {
            if (child === null || child === undefined || child === false) continue;
            parent.appendChild(
                child instanceof Node ? child : document.createTextNode(String(child))
            );
        }
    }

    static clear(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    static qs(selector, root = document) {
        return root.querySelector(selector);
    }

    static qsa(selector, root = document) {
        return [...root.querySelectorAll(selector)];
    }

    static badge(text, tone = 'neutral') {
        return UI.el('span', { class: `badge badge-${tone}`, text });
    }

    static field(label, control, hint = '') {
        return UI.el('label', { class: 'field' },
            UI.el('span', { text: label }),
            control,
            hint ? UI.el('span', { class: 'hint', text: hint }) : null
        );
    }

    static input(name, attrs = {}) {
        return UI.el('input', { class: 'input', name, ...attrs });
    }

    static textarea(name, attrs = {}) {
        return UI.el('textarea', { class: 'textarea', name, ...attrs });
    }

    static select(name, options, attrs = {}) {
        return UI.el('select', { class: 'select', name, ...attrs },
            ...options.map((option) => UI.el('option', {
                value: option.value,
                text: option.label,
                selected: option.selected
            }))
        );
    }

    static formatMoney(value) {
        const number = Number(value) || 0;
        return new Intl.NumberFormat('es-SV', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(number);
    }

    static formatNumber(value) {
        return new Intl.NumberFormat('es-SV').format(Number(value) || 0);
    }

    static formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('es-SV', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
    }

    static formatDateTime(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return `${date.toLocaleDateString('es-SV', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        })} ${date.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}`;
    }

    static initials(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    static loading(label = 'Cargando información…') {
        return UI.el('div', { class: 'loading' },
            UI.el('span', { class: 'spinner' }),
            UI.el('span', { text: label })
        );
    }

    static emptyState(title, message = '') {
        return UI.el('div', { class: 'empty-state' },
            UI.el('div', { class: 'empty-icon', text: '◌' }),
            UI.el('strong', { text: title }),
            message ? UI.el('span', { text: message }) : null
        );
    }

    static pageHead(title, subtitle, actions = []) {
        return UI.el('div', { class: 'page-head' },
            UI.el('div', {},
                UI.el('h2', { text: title }),
                subtitle ? UI.el('p', { text: subtitle }) : null
            ),
            actions.length ? UI.el('div', { class: 'actions' }, ...actions) : null
        );
    }

    static card(title, subtitle, content, actions = []) {
        return UI.el('section', { class: 'card' },
            title ? UI.el('div', { class: 'card-title' },
                UI.el('div', {},
                    UI.el('h3', { text: title }),
                    subtitle ? UI.el('p', { text: subtitle }) : null
                ),
                actions.length ? UI.el('div', { class: 'actions' }, ...actions) : null
            ) : null,
            content
        );
    }

    static tabs(items, activeKey, onChange) {
        return UI.el('div', { class: 'tabs' },
            ...items.map((item) => UI.el('button', {
                type: 'button',
                class: `tab ${item.key === activeKey ? 'active' : ''}`,
                text: item.label,
                on: { click: () => onChange(item.key) }
            }))
        );
    }

    static toast(message, type = 'info') {
        const root = document.getElementById('toast-root');
        if (!root) return;

        const icons = { success: '✓', error: '✕', warning: '!', info: 'i' };
        const node = UI.el('div', { class: `toast ${type}` },
            UI.el('span', { class: 'toast-icon', text: icons[type] || 'i' }),
            UI.el('span', { text: message })
        );
        root.appendChild(node);

        const remove = () => {
            node.style.opacity = '0';
            node.style.transform = 'translateX(14px)';
            setTimeout(() => node.remove(), 180);
        };
        const timer = setTimeout(remove, 4500);
        node.addEventListener('click', () => {
            clearTimeout(timer);
            remove();
        });
    }

    static openModal({
        title,
        subtitle = '',
        body,
        submitLabel = 'Guardar',
        cancelLabel = 'Cancelar',
        onSubmit = null,
        onCancel = null,
        size = '',
        danger = false,
        hideSubmit = false
    }) {
        const root = document.getElementById('modal-root');
        const overlay = UI.el('div', { class: 'modal-overlay' });

        const errorBox = UI.el('div', { class: 'form-error', hidden: true });

        const bodyNode = typeof body === 'string'
            ? UI.el('div', { html: body })
            : body;

        const submitButton = hideSubmit ? null : UI.el('button', {
            type: 'submit',
            class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
            text: submitLabel
        });

        const cancelButton = UI.el('button', {
            type: 'button',
            class: 'btn btn-secondary',
            text: cancelLabel,
            on: { click: () => requestClose(true) }
        });

        const form = UI.el('form', { class: `modal ${size}` },
            UI.el('div', { class: 'modal-head' },
                UI.el('div', {},
                    UI.el('h3', { text: title }),
                    subtitle ? UI.el('p', { text: subtitle }) : null
                ),
                UI.el('button', {
                    type: 'button',
                    class: 'icon-btn',
                    text: '×',
                    'aria-label': 'Cerrar',
                    on: { click: () => requestClose(true) }
                })
            ),
            UI.el('div', { class: 'modal-body' },
                errorBox,
                bodyNode
            ),
            hideSubmit ? null : UI.el('div', { class: 'modal-foot' },
                cancelButton,
                submitButton
            )
        );

        overlay.appendChild(form);
        root.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        let closed = false;

        function close() {
            if (closed) return;
            closed = true;
            overlay.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onKeyDown);
        }

        function requestClose(cancelled = false) {
            if (cancelled && typeof onCancel === 'function') onCancel();
            close();
        }

        function onKeyDown(event) {
            if (event.key === 'Escape') requestClose(true);
        }
        document.addEventListener('keydown', onKeyDown);

        overlay.addEventListener('mousedown', (event) => {
            if (event.target === overlay) requestClose(true);
        });

        if (!hideSubmit) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                errorBox.hidden = true;
                submitButton.disabled = true;
                const original = submitButton.textContent;
                submitButton.textContent = 'Guardando…';

                try {
                    const data = Object.fromEntries(new FormData(form).entries());
                    if (typeof onSubmit === 'function') await onSubmit(data, { close, form });
                    close();
                } catch (error) {
                    errorBox.textContent = error?.message || 'No se pudo completar la operación.';
                    errorBox.hidden = false;
                    submitButton.disabled = false;
                    submitButton.textContent = original;
                }
            });
        }

        const firstInput = form.querySelector('input:not([type="hidden"]), select, textarea');
        if (firstInput) setTimeout(() => firstInput.focus(), 30);

        return { close, form, overlay };
    }

    static confirmDialog({
        title = 'Confirmar operación',
        message = '¿Desea continuar?',
        confirmLabel = 'Confirmar',
        cancelLabel = 'Cancelar',
        danger = false
    }) {
        return new Promise((resolve) => {
            let answered = false;
            const done = (value) => {
                if (answered) return;
                answered = true;
                resolve(value);
            };

            UI.openModal({
                title,
                body: UI.el('p', { class: 'muted', text: message }),
                submitLabel: confirmLabel,
                cancelLabel,
                danger,
                size: 'modal-sm',
                onSubmit: () => done(true),
                onCancel: () => done(false)
            });
        });
    }

    static downloadCsv(filename, rows, columns) {
        const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const header = columns.map((column) => escape(column.label)).join(',');
        const body = rows.map((row) => columns.map((column) => {
            const value = typeof column.value === 'function' ? column.value(row) : row[column.key];
            return escape(value);
        }).join(',')).join('\n');

        const blob = new Blob([`\uFEFF${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    static estadoBadge(estado) {
        const map = {
            REGISTRADA: 'info',
            SOLICITADA: 'warning',
            RECIBIDA: 'success',
            CONFIRMADA: 'success',
            CANCELADA: 'danger',
            ACTIVA: 'danger',
            ATENDIDA: 'success'
        };
        return UI.badge(estado, map[estado] || 'neutral');
    }

    static tipoMovimientoBadge(tipo) {
        const map = {
            COMPRA: 'success',
            VENTA: 'info',
            TRANSFERENCIA_ENTRADA: 'success',
            TRANSFERENCIA_SALIDA: 'warning',
            AJUSTE_ENTRADA: 'success',
            AJUSTE_SALIDA: 'warning'
        };
        return UI.badge(String(tipo || '').replaceAll('_', ' '), map[tipo] || 'neutral');
    }
}

/*
 * Alias funcionales para mantener legibles las plantillas de las páginas.
 * Todos apuntan a los métodos estáticos de UI.
 */
export const el = UI.el.bind(UI);
export const clear = UI.clear.bind(UI);
export const qs = UI.qs.bind(UI);
export const qsa = UI.qsa.bind(UI);
export const badge = UI.badge.bind(UI);
export const field = UI.field.bind(UI);
export const input = UI.input.bind(UI);
export const textarea = UI.textarea.bind(UI);
export const select = UI.select.bind(UI);
export const formatMoney = UI.formatMoney.bind(UI);
export const formatNumber = UI.formatNumber.bind(UI);
export const formatDate = UI.formatDate.bind(UI);
export const formatDateTime = UI.formatDateTime.bind(UI);
export const initials = UI.initials.bind(UI);
export const loading = UI.loading.bind(UI);
export const emptyState = UI.emptyState.bind(UI);
export const pageHead = UI.pageHead.bind(UI);
export const card = UI.card.bind(UI);
export const tabs = UI.tabs.bind(UI);
export const toast = UI.toast.bind(UI);
export const openModal = UI.openModal.bind(UI);
export const confirmDialog = UI.confirmDialog.bind(UI);
export const downloadCsv = UI.downloadCsv.bind(UI);
export const estadoBadge = UI.estadoBadge.bind(UI);
export const tipoMovimientoBadge = UI.tipoMovimientoBadge.bind(UI);
