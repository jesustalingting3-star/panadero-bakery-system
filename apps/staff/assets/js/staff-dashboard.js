(async function () {
    const tableBody = document.getElementById('dashboard-records');
    const empty = document.getElementById('dashboard-empty');
    if (!tableBody || !empty) return;

    const metricStock = document.getElementById('metric-stock');
    const metricPending = document.getElementById('metric-pending');
    const metricReady = document.getElementById('metric-ready');
    const metricAttention = document.getElementById('metric-attention');

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
        }[character]));
    }

    function money(value) {
        return value == null || value === '' ? '—' : '₱' + Number(value).toFixed(2);
    }

    function sourceReady(service) {
        return typeof service.isConnected === 'function' ? service.isConnected() : true;
    }

    function setMetric(element, value, ready) {
        if (!element) return;
        element.textContent = ready ? String(value == null ? 0 : value) : '—';
    }

    async function render() {
        const summary = InventoryService.getSummary();
        const [orders, reservations] = await Promise.all([
            OrderService.getAllOrders(),
            ReservationService.getAllReservations()
        ]);

        const records = orders.concat(reservations).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const inventoryReady = sourceReady(InventoryService);
        const requestsReady = sourceReady(OrderService) || sourceReady(ReservationService);

        setMetric(metricStock, summary && summary.totalStock, inventoryReady);
        setMetric(metricPending, records.filter(record => record.status === 'pending').length, requestsReady);
        setMetric(metricReady, records.filter(record => record.status === 'ready').length, requestsReady);
        setMetric(
            metricAttention,
            summary ? Number(summary.outOfStock || 0) + Number(summary.notSet || 0) : 0,
            inventoryReady
        );

        const recent = records.slice(0, 8);
        tableBody.textContent = '';

        recent.forEach(record => {
            const reference = record.orderNumber || record.reservationNumber || '';
            const customer = [
                record.customer && record.customer.firstName,
                record.customer && record.customer.lastName
            ].filter(Boolean).join(' ') || 'Guest';

            const row = document.createElement('tr');
            row.innerHTML = `<td><strong>${escapeHtml(reference)}</strong></td>
                <td>${record.type === 'reservation' ? 'Reservation' : 'Order'}</td>
                <td>${escapeHtml(customer)}</td>
                <td>${money(record.total)}</td>
                <td><span class="status-badge ${escapeHtml(record.status)}">${escapeHtml(record.status)}</span></td>
                <td>${record.createdAt ? new Date(record.createdAt).toLocaleString() : '—'}</td>`;
            tableBody.appendChild(row);
        });

        empty.textContent = recent.length ? '' : 'No orders or reservations.';
        empty.hidden = recent.length > 0;
    }

    window.addEventListener('panadero-orders-changed', render);
    window.addEventListener('panadero-reservations-changed', render);
    window.addEventListener('panadero-inventory-changed', render);
    render();
})();
