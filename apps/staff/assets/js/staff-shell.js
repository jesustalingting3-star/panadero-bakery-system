(function () {
    const root = document.getElementById('staff-shell');
    const template = document.getElementById('staff-page-content');
    if (!root || !template) return;

    const page = document.body.dataset.staffPage || 'dashboard';
    const links = [
        ['dashboard','staff-dashboard.html','Dashboard'],
        ['inventory','staff-inventory.html','Inventory & Batches'],
        ['orders','staff-orders.html','Orders & Reservations']
    ];

    const header = `<header class="staff-home-header">
        <div class="staff-header-container">
            <a class="staff-home-logo" href="staff-dashboard.html">PANADERO</a>
            <button type="button" id="staff-menu-button" class="staff-menu-button" aria-controls="staff-navigation" aria-label="Toggle staff navigation" aria-expanded="false">☰</button>
            <nav class="staff-home-nav" id="staff-navigation" aria-label="Staff navigation">
                ${links.map(([key,url,label]) => `<a class="${page===key?'active':''}" href="${url}" ${page===key?'aria-current="page"':''}>${label}</a>`).join('')}
            </nav>
        </div>
    </header>`;

    const footer = `<footer class="staff-home-footer">
        <a href="staff-dashboard.html" class="staff-footer-logo">PANADERO</a>
        <p>Freshly baked. Simply delicious.</p>
        <p class="staff-copyright">&copy; ${new Date().getFullYear()} PANADERO.</p>
    </footer>`;

    root.innerHTML = header + '<main class="staff-main" id="staff-main"></main>' + footer;
    document.getElementById('staff-main').appendChild(template.content.cloneNode(true));

    const button = document.getElementById('staff-menu-button');
    const navigation = document.getElementById('staff-navigation');

    function closeMenu() {
        if (!button || !navigation) return;
        navigation.classList.remove('show');
        button.setAttribute('aria-expanded','false');
        button.textContent='☰';
    }

    if (button && navigation) {
        button.addEventListener('click', function () {
            const open = navigation.classList.toggle('show');
            button.setAttribute('aria-expanded',String(open));
            button.textContent = open ? '✕' : '☰';
        });
        document.addEventListener('keydown', event => { if(event.key === 'Escape') closeMenu(); });
        document.addEventListener('click', event => {
            if(!navigation.contains(event.target) && !button.contains(event.target)) closeMenu();
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
