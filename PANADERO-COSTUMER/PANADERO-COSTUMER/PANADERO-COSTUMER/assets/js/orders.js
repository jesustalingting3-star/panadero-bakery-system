(function () {
    const buttons = [...document.querySelectorAll('.tab-button')];
    const panels = [...document.querySelectorAll('.records-panel')];
    const signin = document.getElementById('signin-state');

    function activate(name) {
        buttons.forEach(function (button) {
            const active = button.dataset.tab === name;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        panels.forEach(function (panel) {
            panel.hidden = panel.dataset.panel !== name;
        });
    }

    buttons.forEach(function (button) {
        button.addEventListener('click', function () { activate(button.dataset.tab); });
    });
    activate('orders');

    function getReference(record, type) {
        if (type === 'order') {
            return record.orderNumber || record.order_number || record.reference || '';
        }
        return record.reservationNumber || record.reservation_number || record.reference || '';
    }

    function render(records, listId, emptyId, filterId, type) {
        const list = document.getElementById(listId);
        const empty = document.getElementById(emptyId);
        const filter = document.getElementById(filterId);
        if (!list || !empty || !filter) return;

        function draw() {
            const value = filter.value;
            const shown = records.filter(function (record) {
                return value === 'all' || record.status === value;
            });

            list.textContent = '';
            for (const record of shown) {
                const card = document.createElement('article');
                card.className = 'record-card';
                const reference = getReference(record, type);
                const date = record.createdAt || record.created_at || '';
                const dateText = date ? new Date(date).toLocaleString() : '';
                const statusLabels = { pending: 'Received', processing: 'Processing', ready: 'Ready for Pickup', completed: 'Completed', cancelled: 'Cancelled' };
                const statusLabel = statusLabels[String(record.status || '').toLowerCase()] || record.status || 'Received';
                const statusNote = statusLabel === 'Received' ? 'Order received. Staff will update it when preparation begins.' : '';
                card.innerHTML = `<div class="record-top"><div><strong>${type === 'order' ? 'Order' : 'Reservation'}${reference ? ' ' + reference : ''}</strong><p class="record-meta">${dateText}</p>${statusNote ? `<p class="record-meta">${statusNote}</p>` : ''}</div><span class="record-status">${statusLabel}</span></div>`;
                list.appendChild(card);
            }
            empty.hidden = shown.length > 0;
        }

        filter.addEventListener('change', draw);
        draw();
    }

    async function load() {
        const user = window.AuthService ? AuthService.getCurrentUser() : null;
        if (!user) {
            if (signin) signin.hidden = false;
            render([], 'orders-list', 'orders-empty', 'order-filter', 'order');
            render([], 'reservations-list', 'reservations-empty', 'reservation-filter', 'reservation');
            return;
        }

        if (signin) signin.hidden = true;
        const [orders, reservations] = await Promise.all([
            OrderService.getOrders(),
            ReservationService.getReservations()
        ]);
        render(orders, 'orders-list', 'orders-empty', 'order-filter', 'order');
        render(reservations, 'reservations-list', 'reservations-empty', 'reservation-filter', 'reservation');
    }

    window.addEventListener('panadero-auth-changed', load);
    load();
})();
