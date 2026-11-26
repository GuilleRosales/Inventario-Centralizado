import { api } from './api.js';

/**
 * Página de inicio de sesión.
 * Encapsula el formulario, las credenciales de demostración y el manejo de errores.
 */
export class LoginPage {
    constructor() {
        this.form = document.getElementById('login-form');
        this.errorBox = document.getElementById('login-error');
        this.submit = document.getElementById('login-submit');
    }

    init() {
        if (api.getToken()) {
            location.replace('/app.html');
            return;
        }

        for (const button of document.querySelectorAll('[data-demo]')) {
            button.addEventListener('click', () => this.fillDemo(button));
        }

        this.form.addEventListener('submit', (event) => this.submitForm(event));
    }

    fillDemo(button) {
        const [correo, password] = button.dataset.demo.split('|');
        const campos = this.form.elements;
        campos.correo.value = correo;
        campos.password.value = password;
        campos.password.focus();
    }

    async submitForm(event) {
        event.preventDefault();
        this.errorBox.hidden = true;
        this.submit.disabled = true;
        this.submit.textContent = 'Verificando…';

        try {
            const campos = this.form.elements;
            const data = await api.post('/auth/login', {
                correo: campos.correo.value,
                password: campos.password.value
            });
            api.setSession(data.token, data.usuario);
            location.href = '/app.html';
        } catch (error) {
            this.errorBox.textContent = error.message || 'No se pudo iniciar sesión.';
            this.errorBox.hidden = false;
            this.submit.disabled = false;
            this.submit.textContent = 'Ingresar al sistema';
        }
    }
}

new LoginPage().init();
