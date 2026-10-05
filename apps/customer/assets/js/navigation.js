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

    function accountMarkup(active) {
        const user = getCurrentUser();
        if (!user) {
            return `<a href="login.html" class="${active === 'login' ? 'active' : ''}" ${active === 'login' ? 'aria-current="page"' : ''}><span class="account-label">Login</span></a>`;
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

        return `<header class="site-header"><div class="header-container"><a href="index.html" class="logo">PANADERO</a><button type="button" class="menu-button" id="menu-button" aria-label="Toggle navigation" aria-controls="navigation" aria-expanded="false">☰</button><nav class="site-nav" id="navigation">${link('home', 'index.html', 'Home')}${link('menu', 'menu.html', 'Menu')}${link('orders', 'track-order.html', 'My Orders &amp; Reservations')}${accountMarkup(active)}<button type="button" class="cart-link open-cart">Cart (<span class="cart-count">0</span>)</button></nav></div></header>`;
    }

    function footerMarkup() {
        return `<footer class="site-footer"><a href="index.html" class="footer-logo">PANADERO</a><p>Freshly baked. Simply delicious.</p><p class="copyright">&copy; <span id="year"></span> PANADERO.</p></footer>`;
    }

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

        if (logoutButton) {
            logoutButton.addEventListener('click', async function () {
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

    document.addEventListener('click', function (event) {
        const wrap = event.target.closest('.profile-menu-wrap');
        if (wrap) return;
        const menu = document.getElementById('profile-menu');
        const trigger = document.getElementById('profile-trigger');
        if (menu && trigger) {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
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
    });

    document.addEventListener('error', function (event) {
        const image = event.target;
        if (image && image.tagName === 'IMG' && !image.dataset.fallbackApplied) {
            image.dataset.fallbackApplied = 'true';
            image.src = window.ProductService ? ProductService.fallbackImage : '';
        }
    }, true);

})();
