(function () {
    const root = document.getElementById('staff-shell');
    const template = document.getElementById('staff-page-content');
    if (!root || !template) return;

    const page = document.body.dataset.staffPage || 'dashboard';
    const links = [
        { key: 'dashboard', url: 'staff-dashboard.html', label: 'Dashboard', icon: 'dashboard' },
        { key: 'inventory', url: 'staff-inventory.html', label: 'Inventory', icon: 'inventory' },
        { key: 'orders', url: 'staff-orders.html', label: 'Active Orders', icon: 'orders' }
    ];

    function icon(name) {
        const map = {
            dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="5" rx="1.5"></rect><rect x="14" y="11" width="7" height="10" rx="1.5"></rect><rect x="3" y="12" width="7" height="9" rx="1.5"></rect></svg>',
            inventory: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M7 3h10l2 4H5l2-4Z"></path><path d="M5 7h14v12H5z"></path><path d="M9 11h6"></path><path d="M9 15h6"></path></svg>',
            orders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10"></path><path d="M7 7h10"></path><path d="M7 11h10"></path><path d="M7 15h6"></path><path d="M5 21h14a2 2 0 0 0 2-2V5l-4-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"></path></svg>',
            user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
            logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l-5-5 5-5"></path><path d="M5 12h11"></path><path d="M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4"></path></svg>'
        };
        return map[name] || '';
    }

    function ensureConfirmDialog() {
        let dialog = document.getElementById('staff-confirm-dialog');
        if (dialog) return dialog;

        dialog = document.createElement('dialog');
        dialog.id = 'staff-confirm-dialog';
        dialog.className = 'staff-dialog staff-confirm-dialog';
        dialog.setAttribute('aria-labelledby', 'staff-confirm-title');
        dialog.innerHTML = `<div class="staff-dialog-header">
            <h2 id="staff-confirm-title">Confirm action</h2>
            <button type="button" class="dialog-close staff-confirm-close" aria-label="Close">×</button>
        </div>
        <div class="staff-confirm-body">
            <p id="staff-confirm-message"></p>
            <div class="staff-confirm-actions">
                <button type="button" class="staff-secondary staff-confirm-cancel">Cancel</button>
                <button type="button" class="staff-primary staff-confirm-submit">Confirm</button>
            </div>
        </div>`;
        document.body.appendChild(dialog);
        return dialog;
    }

    window.StaffConfirm = function (options) {
        const settings = options || {};
        const dialog = ensureConfirmDialog();

        if (typeof dialog.showModal !== 'function') {
            return Promise.resolve(window.confirm(settings.message || settings.title || 'Continue?'));
        }

        const title = dialog.querySelector('#staff-confirm-title');
        const message = dialog.querySelector('#staff-confirm-message');
        const cancel = dialog.querySelector('.staff-confirm-cancel');
        const submit = dialog.querySelector('.staff-confirm-submit');
        const close = dialog.querySelector('.staff-confirm-close');

        title.textContent = settings.title || 'Confirm action';
        message.textContent = settings.message || '';
        submit.textContent = settings.confirmText || 'Confirm';
        submit.classList.toggle('danger', !!settings.danger);

        return new Promise(function (resolve) {
            let settled = false;
            function finish(value) {
                if (settled) return;
                settled = true;
                resolve(value);
            }

            cancel.onclick = function () { dialog.close('cancel'); };
            close.onclick = function () { dialog.close('cancel'); };
            submit.onclick = function () { dialog.close('confirm'); };
            dialog.oncancel = function () { dialog.returnValue = 'cancel'; };
            dialog.onclose = function () { finish(dialog.returnValue === 'confirm'); };

            dialog.returnValue = '';
            dialog.showModal();
        });
    };


    root.innerHTML = `
        <div class="staff-app-shell">
            <aside class="staff-sidebar" id="staff-sidebar" aria-label="Staff sidebar">
                <div class="staff-sidebar-brand">
                    <a href="staff-dashboard.html"><img class="staff-logo-img" src="assets/images/logo.jpg" alt="" width="52" height="52" data-fallback-applied="true" onerror="this.onerror=null;this.src='assets/images/logo.svg'">PANADERO</a>
                    <span>Staff</span>
                </div>
                <nav class="staff-sidebar-nav" aria-label="Staff navigation">
                    ${links.map(link => `<a class="staff-nav-link ${page === link.key ? 'active' : ''}" href="${link.url}" ${page === link.key ? 'aria-current="page"' : ''}><span class="staff-nav-icon">${icon(link.icon)}</span><span>${link.label}</span></a>`).join('')}
                </nav>
                <div class="staff-sidebar-account" aria-label="Staff account">
                    <span class="staff-account-avatar">${icon('user')}</span>
                    <span class="staff-account-copy"><strong>Staff</strong><small>Account</small></span>
                </div>
                <button type="button" class="staff-sidebar-logout" id="staff-logout-button"><span class="staff-nav-icon">${icon('logout')}</span><span>Logout</span></button>
            </aside>
            <div class="staff-sidebar-backdrop" id="staff-sidebar-backdrop" hidden></div>
            <div class="staff-shell-main">
                <header class="staff-mobile-bar">
                    <button type="button" id="staff-menu-button" class="staff-menu-button" aria-controls="staff-sidebar" aria-label="Toggle staff navigation" aria-expanded="false">☰</button>
                </header>
                <main class="staff-main" id="staff-main"></main>
                <footer class="staff-home-footer">
                    <a href="staff-dashboard.html" class="staff-footer-logo">PANADERO</a>
                    <p>Freshly baked. Simply delicious.</p>
                    <p class="staff-copyright">&copy; ${new Date().getFullYear()} PANADERO.</p>
                </footer>
            </div>
        </div>`;

    document.getElementById('staff-main').appendChild(template.content.cloneNode(true));

    const button = document.getElementById('staff-menu-button');
    const sidebar = document.getElementById('staff-sidebar');
    const backdrop = document.getElementById('staff-sidebar-backdrop');
    const logoutButton = document.getElementById('staff-logout-button');

    function closeMenu() {
        document.body.classList.remove('sidebar-open');
        if (button) {
            button.setAttribute('aria-expanded', 'false');
            button.textContent = '☰';
        }
        if (backdrop) backdrop.hidden = true;
    }

    function openMenu() {
        document.body.classList.add('sidebar-open');
        if (button) {
            button.setAttribute('aria-expanded', 'true');
            button.textContent = '✕';
        }
        if (backdrop) backdrop.hidden = false;
    }

    if (button && sidebar) {
        button.addEventListener('click', function () {
            const open = !document.body.classList.contains('sidebar-open');
            open ? openMenu() : closeMenu();
        });
        if (backdrop) backdrop.addEventListener('click', closeMenu);
        document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
        document.addEventListener('click', event => {
            if (window.innerWidth > 920) return;
            if (sidebar.contains(event.target) || button.contains(event.target)) return;
            closeMenu();
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async function () {
            const confirmed = window.StaffConfirm
                ? await StaffConfirm({
                    title: 'Log out?',
                    message: 'You will return to the login page.',
                    confirmText: 'Logout'
                })
                : window.confirm('Log out?');
            if (!confirmed) return;
            try { sessionStorage.removeItem('panadero-auth-session-v3'); localStorage.removeItem('panadero-auth-session-v3'); sessionStorage.removeItem('panadero-auth-session-v2'); localStorage.removeItem('panadero-auth-session-v2'); } catch (_) {}
            window.location.href = '../PANADERO-COSTUMER/login.html';
        });
    }

    document.addEventListener('error', function (event) {
        const image = event.target;
        if (image && image.tagName === 'IMG' && !image.dataset.fallbackApplied) {
            image.dataset.fallbackApplied = 'true';
            image.src = PANADERO_DATA.fallbackImage;
        }
    }, true);
})();
