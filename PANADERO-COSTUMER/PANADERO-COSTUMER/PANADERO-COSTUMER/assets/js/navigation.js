(function () {
    function getCurrentUser() {
        return window.AuthService ? AuthService.getCurrentUser() : null;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function initials(user) {
        const first = String(user.firstName || '').trim().charAt(0);
        const last = String(user.lastName || '').trim().charAt(0);
        return (first + last || 'U').toUpperCase();
    }

    const NOTIFICATIONS_KEY = 'panadero-notifications-v1';

    function readNotifications() {
        try {
            const items = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
            return Array.isArray(items) ? items : [];
        } catch (_) {
            return [];
        }
    }

    function saveNotifications(items) {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items));
    }

    function notificationBelongsToUser(item, user) {
        if (!item || !user) return false;
        if (item.userId && user.id) return String(item.userId) === String(user.id);
        return String(item.email || '').toLowerCase() === String(user.email || '').toLowerCase();
    }

    function userNotifications(user) {
        return readNotifications()
            .filter(item => notificationBelongsToUser(item, user))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    function notificationMarkup(user) {
        if (!user) return '';
        const items = userNotifications(user);
        const unread = items.filter(item => !item.read).length;
        return `<div class="notification-menu-wrap">
            <button type="button" class="notification-trigger" id="notification-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="notification-menu" aria-label="Notifications">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>
                <span class="notification-count" id="notification-count" ${unread ? '' : 'hidden'}>${unread > 99 ? '99+' : unread}</span>
            </button>
            <div class="notification-menu" id="notification-menu" hidden>
                <div class="notification-menu-head"><strong>Notifications</strong></div>
                <div class="notification-list" id="notification-list"></div>
            </div>
        </div>`;
    }

    function notificationDestination(item) {
        const tab = item && item.type === 'reservation' ? 'reservations' : 'orders';
        const ref = encodeURIComponent(item && item.reference || '');
        return `track-order.html?tab=${tab}${ref ? '&ref=' + ref : ''}`;
    }

    function renderNotificationList() {
        const user = getCurrentUser();
        const list = document.getElementById('notification-list');
        const count = document.getElementById('notification-count');
        if (!user || !list || !count) return;

        const items = userNotifications(user);
        const unread = items.filter(item => !item.read).length;
        count.textContent = unread > 99 ? '99+' : String(unread);
        count.hidden = unread === 0;

        if (!items.length) {
            list.innerHTML = '<p class="notification-empty">No notifications.</p>';
            return;
        }

        list.innerHTML = items.slice(0, 12).map(item => {
            const when = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
            return `<a class="notification-item${item.read ? '' : ' unread'}" href="${notificationDestination(item)}" data-notification-id="${escapeHtml(item.id || '')}">
                <span>${escapeHtml(item.message || 'Order update')}</span>
                ${when ? `<small>${escapeHtml(when)}</small>` : ''}
            </a>`;
        }).join('');
    }

    function markNotificationRead(id) {
        if (!id) return;
        const items = readNotifications();
        const target = items.find(item => String(item.id) === String(id));
        if (!target || target.read) return;
        target.read = true;
        saveNotifications(items);
    }

    function markAllNotificationsRead(user) {
        const items = readNotifications();
        let changed = false;
        items.forEach(item => {
            if (notificationBelongsToUser(item, user) && !item.read) {
                item.read = true;
                changed = true;
            }
        });
        if (changed) saveNotifications(items);
    }

    function accountMarkup(active) {
        const user = getCurrentUser();
        if (!user) {
            const loginActive = active === 'login' || active === 'signup';
            const loginClass = loginActive ? 'active' : '';
            const loginCurrent = loginActive ? 'aria-current="page"' : '';
            return `<a href="login.html" class="${loginClass}" ${loginCurrent}><span class="account-label">Login</span></a>`;
        }

        const name = escapeHtml(user.displayName || user.firstName || 'Account');
        const email = escapeHtml(user.email || '');
        const avatarText = escapeHtml(initials(user));
        const avatar = user.avatarUrl
            ? `<img class="profile-avatar profile-avatar-image" src="${escapeHtml(user.avatarUrl)}" alt="">`
            : `<span class="profile-avatar" aria-hidden="true">${avatarText}</span>`;
        const largeAvatar = user.avatarUrl
            ? `<img class="profile-avatar large profile-avatar-image" src="${escapeHtml(user.avatarUrl)}" alt="">`
            : `<span class="profile-avatar large" aria-hidden="true">${avatarText}</span>`;

        return `<div class="profile-menu-wrap">
            <button type="button" class="profile-trigger" id="profile-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="profile-menu">
                ${avatar}
                <span class="profile-name">${name}</span>
                <span class="profile-chevron" aria-hidden="true">▾</span>
            </button>
            <div class="profile-menu" id="profile-menu" hidden>
                <div class="profile-summary">
                    ${largeAvatar}
                    <div><strong>${name}</strong><span>${email}</span></div>
                </div>
                <button type="button" id="logout-button" class="profile-logout">Logout</button>
            </div>
        </div>`;
    }

    function navMarkup(active) {
        function link(key, href, label) {
            return `<a href="${href}" class="${active === key ? 'active' : ''}" ${active === key ? 'aria-current="page"' : ''}>${label}</a>`;
        }

        const user = getCurrentUser();
        return `<header class="site-header"><div class="header-container"><a href="index.html" class="logo"><img class="logo-img" src="assets/images/logo.jpg" alt="" width="64" height="64" data-fallback-applied="true" onerror="this.onerror=null;this.src='assets/images/logo.svg'"><span class="logo-text">PANADERO</span></a><button type="button" class="menu-button" id="menu-button" aria-label="Toggle navigation" aria-controls="navigation" aria-expanded="false">☰</button><nav class="site-nav" id="navigation">${link('home', 'index.html', 'Home')}${link('menu', 'menu.html', 'Menu')}${link('orders', 'track-order.html', 'My Orders &amp; Reservations')}${notificationMarkup(user)}${accountMarkup(active)}<button type="button" class="cart-link open-cart">Cart (<span class="cart-count">0</span>)</button></nav></div></header>`;
    }

    function footerMarkup() {
        return `<footer class="site-footer"><a href="index.html" class="footer-logo">PANADERO</a><p>Freshly baked. Simply delicious.</p><p class="copyright">&copy; <span id="year"></span> PANADERO.</p></footer>`;
    }

    function ensureConfirmDialog() {
        let dialog = document.getElementById('site-confirm-dialog');
        if (dialog) return dialog;

        dialog = document.createElement('dialog');
        dialog.id = 'site-confirm-dialog';
        dialog.className = 'site-confirm-dialog';
        dialog.setAttribute('aria-labelledby', 'site-confirm-title');
        dialog.innerHTML = `<div class="site-confirm-header">
            <h2 id="site-confirm-title">Confirm action</h2>
            <button type="button" class="site-confirm-close" aria-label="Close">×</button>
        </div>
        <div class="site-confirm-body">
            <p id="site-confirm-message"></p>
            <div class="site-confirm-actions">
                <button type="button" class="button secondary site-confirm-cancel">Cancel</button>
                <button type="button" class="button site-confirm-submit">Confirm</button>
            </div>
        </div>`;
        document.body.appendChild(dialog);
        return dialog;
    }

    window.PanaderoConfirm = function (options) {
        const settings = options || {};
        const dialog = ensureConfirmDialog();

        if (typeof dialog.showModal !== 'function') {
            return Promise.resolve(window.confirm(settings.message || settings.title || 'Continue?'));
        }

        const title = dialog.querySelector('#site-confirm-title');
        const message = dialog.querySelector('#site-confirm-message');
        const cancel = dialog.querySelector('.site-confirm-cancel');
        const submit = dialog.querySelector('.site-confirm-submit');
        const close = dialog.querySelector('.site-confirm-close');

        title.textContent = settings.title || 'Confirm action';
        message.textContent = settings.message || '';
        submit.textContent = settings.confirmText || 'Confirm';
        submit.classList.toggle('danger-action', !!settings.danger);

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

    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    const page = document.body.dataset.page || '';

    function setupHeader() {
        if (!header) return;
        header.innerHTML = navMarkup(page);

        const menuButton = document.getElementById('menu-button');
        const navigation = document.getElementById('navigation');
        const profileTrigger = document.getElementById('profile-trigger');
        const profileMenu = document.getElementById('profile-menu');
        const logoutButton = document.getElementById('logout-button');
        const notificationTrigger = document.getElementById('notification-trigger');
        const notificationMenu = document.getElementById('notification-menu');

        if (menuButton && navigation) {
            menuButton.addEventListener('click', function () {
                const open = navigation.classList.toggle('show');
                menuButton.setAttribute('aria-expanded', String(open));
                menuButton.textContent = open ? '✕' : '☰';
            });
        }

        if (profileTrigger && profileMenu) {
            profileTrigger.addEventListener('click', function (event) {
                event.stopPropagation();
                const open = profileMenu.hidden;
                profileMenu.hidden = !open;
                profileTrigger.setAttribute('aria-expanded', String(open));
            });
        }

        if (notificationTrigger && notificationMenu) {
            renderNotificationList();
            notificationTrigger.addEventListener('click', function (event) {
                event.stopPropagation();
                const open = notificationMenu.hidden;
                notificationMenu.hidden = !open;
                notificationTrigger.setAttribute('aria-expanded', String(open));
                if (open) {
                    const user = getCurrentUser();
                    if (user) markAllNotificationsRead(user);
                    renderNotificationList();
                }
            });

            notificationMenu.addEventListener('click', function (event) {
                const item = event.target.closest('[data-notification-id]');
                if (!item) return;
                markNotificationRead(item.dataset.notificationId);
            });
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', async function () {
                const confirmed = window.PanaderoConfirm
                    ? await PanaderoConfirm({
                        title: 'Log out?',
                        message: 'You will need to log in again to access your account.',
                        confirmText: 'Logout'
                    })
                    : window.confirm('Log out?');

                if (!confirmed) return;

                logoutButton.disabled = true;
                if (window.AuthService) await AuthService.logout();
                window.location.href = 'login.html';
            });
        }
    }

    setupHeader();

    if (footer) footer.innerHTML = footerMarkup();
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    window.addEventListener('panadero-auth-changed', setupHeader);
    window.addEventListener('storage', function (event) {
        if (event.key === NOTIFICATIONS_KEY && getCurrentUser()) {
            renderNotificationList();
        }
    });

    document.addEventListener('click', function (event) {
        const wrap = event.target.closest('.profile-menu-wrap');
        if (wrap) return;
        const menu = document.getElementById('profile-menu');
        const trigger = document.getElementById('profile-trigger');
        if (menu && trigger) {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        }
        const notificationMenu = document.getElementById('notification-menu');
        const notificationTrigger = document.getElementById('notification-trigger');
        if (notificationMenu && notificationTrigger && !event.target.closest('.notification-menu-wrap')) {
            notificationMenu.hidden = true;
            notificationTrigger.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        const menu = document.getElementById('profile-menu');
        const trigger = document.getElementById('profile-trigger');
        if (menu && trigger) {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus();
        }
        const notificationMenu = document.getElementById('notification-menu');
        const notificationTrigger = document.getElementById('notification-trigger');
        if (notificationMenu && notificationTrigger) {
            notificationMenu.hidden = true;
            notificationTrigger.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('error', function (event) {
        const image = event.target;
        if (image && image.tagName === 'IMG' && !image.dataset.fallbackApplied) {
            image.dataset.fallbackApplied = 'true';
            image.src = window.ProductService ? ProductService.fallbackImage : '';
        }
    }, true);

})();
