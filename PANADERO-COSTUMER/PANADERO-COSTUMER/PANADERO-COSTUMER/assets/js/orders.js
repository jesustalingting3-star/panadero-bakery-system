(function () {
    const buttons = [...document.querySelectorAll('.tab-button')];
    const panels = [...document.querySelectorAll('.records-panel')];
    const signin = document.getElementById('signin-state');
    const message = document.getElementById('records-message');

    function setMessage(text, type) {
        if (!message) return;
        message.textContent = text || '';
        message.className = 'status-message' + (type ? ' ' + type : '');
    }

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

    const pageParams = new URLSearchParams(window.location.search);
    const requestedTab = pageParams.get('tab');
    const requestedReference = pageParams.get('ref');
    activate(requestedTab === 'reservations' ? 'reservations' : 'orders');

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
                const canCancel = type === 'order' && ['placed', 'pending'].includes(record.status);
                const paymentLabel = type === 'order' && record.paymentMethod
                    ? { cash: 'Cash', card: 'Card', gcash: 'GCash' }[record.paymentMethod] || record.paymentMethod
                    : '';
                card.innerHTML = `<div class="record-top"><div><strong>${type === 'order' ? 'Order' : 'Reservation'}${reference ? ' ' + reference : ''}</strong><p class="record-meta">${dateText}${paymentLabel ? ' • Payment: ' + paymentLabel : ''}</p></div><span class="record-status">${record.status || ''}</span></div>${canCancel ? '<div class="record-actions"><button type="button" class="record-cancel-button">Cancel Order</button></div>' : ''}`;
                if (requestedReference && reference && String(reference) === requestedReference) {
                    card.setAttribute('aria-current', 'true');
                }

                const cancelButton = card.querySelector('.record-cancel-button');
                if (cancelButton) {
                    cancelButton.addEventListener('click', async function () {
                        const confirmed = window.PanaderoConfirm
                            ? await PanaderoConfirm({
                                title: 'Cancel order?',
                                message: `${reference || 'This order'} will be cancelled.`,
                                confirmText: 'Cancel Order',
                                danger: true
                            })
                            : window.confirm('Cancel this order?');

                        if (!confirmed) return;

                        cancelButton.disabled = true;
                        const result = await OrderService.cancelOrder(record.id);
                        setMessage(result.ok ? 'Order cancelled.' : result.message, result.ok ? 'success' : 'error');
                        if (result.ok) await load();
                        else cancelButton.disabled = false;
                    });
                }

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
