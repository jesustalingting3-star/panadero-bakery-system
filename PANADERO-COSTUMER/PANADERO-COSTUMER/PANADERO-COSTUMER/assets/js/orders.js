(function () {
    const safeHtml = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
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
    let showNewReceipt = pageParams.get('receipt') === '1';
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
                card.innerHTML = `<div class="record-top"><div><strong>${type === 'order' ? 'Order' : 'Reservation'}${reference ? ' ' + safeHtml(reference) : ''}</strong><p class="record-meta">${safeHtml(dateText)}${paymentLabel ? ' • Payment: ' + safeHtml(paymentLabel) : ''}</p></div><span class="record-status">${safeHtml(record.status || '')}</span></div>${type === 'order' ? '<div class="record-actions"><button type="button" class="record-receipt-button">View Receipt</button>' + (canCancel ? '<button type="button" class="record-cancel-button">Cancel Order</button>' : '') + '</div>' : ''}`;
                if (requestedReference && reference && String(reference) === requestedReference) {
                    card.setAttribute('aria-current', 'true');
                }

                const receiptButton = card.querySelector('.record-receipt-button');
                if (receiptButton && window.OrderReceipt) receiptButton.addEventListener('click', () => OrderReceipt.open(record));

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
                        let result;
                        try { result = await OrderService.cancelOrder(record.id); }
                        catch (_) { result = {ok:false,message:'Unable to cancel order. Try again.'}; }
                        setMessage(result.ok ? 'Order cancelled.' : result.message, result.ok ? 'success' : 'error');
                        if (result.ok) await load();
                        else cancelButton.disabled = false;
                    });
                }

                list.appendChild(card);
            }
            empty.hidden = shown.length > 0;
        }

        filter.onchange = draw;
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
        if (showNewReceipt && requestedReference && window.OrderReceipt) {
            const placedOrder = orders.find(order => getReference(order, 'order') === requestedReference);
            if (placedOrder) {
                showNewReceipt = false;
                OrderReceipt.open(placedOrder);
                const currentUrl = new URL(location.href);
                currentUrl.searchParams.delete('receipt');
                history.replaceState({}, '', currentUrl.href);
            }
        }
        render(reservations, 'reservations-list', 'reservations-empty', 'reservation-filter', 'reservation');
    }

    window.addEventListener('panadero-auth-changed', load);
    load();
})();
