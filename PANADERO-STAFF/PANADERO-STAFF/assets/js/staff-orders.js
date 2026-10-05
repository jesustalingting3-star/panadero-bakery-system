(async function () {
    const table = document.getElementById('records-table');
    if (!table) return;

    const search = document.getElementById('record-search');
    const typeFilter = document.getElementById('record-type');
    const statusFilter = document.getElementById('record-status');
    const empty = document.getElementById('records-empty');
    const message = document.getElementById('records-message');
    let records = [];

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
        }[character]));
    }

    function money(value) {
        return value == null || value === '' ? '—' : '₱' + Number(value).toFixed(2);
    }

    function title(value) {
        return ({ pending: 'Pending', processing: 'Processing', preparing: 'Processing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' })[String(value || '').toLowerCase()] || String(value || '').replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function setMessage(text, type) {
        message.textContent = text || '';
        message.className = 'staff-message' + (type ? ' ' + type : '');
    }

    function statusOptions(record) {
        const statuses = ['pending', 'processing', 'ready', 'completed'];
        const current = String(record.status || '').toLowerCase() === 'preparing' ? 'processing' : String(record.status || '').toLowerCase();
        return statuses
            .map(status => `<option value="${status}" ${current === status ? 'selected' : ''}>${title(status)}</option>`)
            .join('');
    }

    function scheduleText(record) {
        if (record.type === 'reservation') {
            const schedule = [
                record.schedule && record.schedule.preferredDate,
                record.schedule && record.schedule.preferredTime
            ].filter(Boolean).join(' ');
            return escapeHtml(schedule || 'Not specified');
        }

        const method = title(record.fulfillment && record.fulfillment.method || 'pickup');
        const when = [
            record.fulfillment && record.fulfillment.preferredDate,
            record.fulfillment && record.fulfillment.preferredTime
        ].filter(Boolean).join(' ');
        const address = record.fulfillment && record.fulfillment.deliveryAddress;

        return escapeHtml(method) +
            (address ? '<br><small>' + escapeHtml(address) + '</small>' : '') +
            (when ? '<br><small>' + escapeHtml(when) + '</small>' : '');
    }

    function searchableText(record) {
        return [
            record.orderNumber,
            record.reservationNumber,
            record.customer && record.customer.firstName,
            record.customer && record.customer.lastName,
            record.customer && record.customer.email
        ].concat((record.items || []).map(item => item.name)).join(' ').toLowerCase();
    }

    function render() {
        const query = search.value.trim().toLowerCase();
        const type = typeFilter.value;
        const status = statusFilter.value;
        const shown = records.filter(record =>
            (!query || searchableText(record).includes(query)) &&
            (type === 'all' || record.type === type) &&
            (status === 'all' || record.status === status)
        );

        table.textContent = '';
        shown.forEach(record => {
            const reference = record.orderNumber || record.reservationNumber || '';
            const customerName = [
                record.customer && record.customer.firstName,
                record.customer && record.customer.lastName
            ].filter(Boolean).join(' ') || 'Guest';
            const productText = (record.items || [])
                .map(item => escapeHtml(item.name) + ' × ' + Number(item.quantity || 0))
                .join('<br>');

            const row = document.createElement('tr');
            row.dataset.recordId = record.id;
            row.dataset.recordType = record.type;
            row.innerHTML = `<td><strong>${escapeHtml(reference)}</strong><div class="order-items">${record.type === 'reservation' ? 'Reservation' : 'Order'}${record.createdAt ? '<br>' + new Date(record.createdAt).toLocaleString() : ''}</div></td>
                <td><div class="order-customer"><strong>${escapeHtml(customerName)}</strong><span>${escapeHtml(record.customer && record.customer.email || '')}</span><span>${escapeHtml(record.customer && record.customer.mobile || '')}</span></div></td>
                <td><div class="order-items">${productText}</div></td>
                <td>${scheduleText(record)}</td>
                <td><strong>${money(record.total)}</strong></td>
                <td><span class="status-badge ${escapeHtml(record.status)}">${escapeHtml(title(record.status))}</span></td>
                <td><div class="stock-editor"><select class="staff-field record-status-select" aria-label="Status for ${escapeHtml(reference)}">${statusOptions(record)}</select><button type="button" class="staff-small-button save-status">Save</button></div></td>`;
            table.appendChild(row);

            if (record.status === 'completed') {
                row.querySelector('.record-status-select').disabled = true;
                row.querySelector('.save-status').disabled = true;
            }
        });

        empty.textContent = shown.length ? '' : (records.length ? 'No matching records.' : 'No orders or reservations.');
        empty.hidden = shown.length > 0;
    }

    async function load() {
        const [orders, reservations] = await Promise.all([
            OrderService.getAllOrders(),
            ReservationService.getAllReservations()
        ]);
        records = orders.concat(reservations).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setMessage('');
        render();
    }

    [search, typeFilter, statusFilter].forEach(control => {
        control.addEventListener(control === search ? 'input' : 'change', render);
    });

    table.addEventListener('click', async function (event) {
        const button = event.target.closest('.save-status');
        if (!button) return;

        const row = button.closest('tr');
        const selectedStatus = row.querySelector('.record-status-select').value;
        button.disabled = true;

        try {
            const result = row.dataset.recordType === 'reservation'
                ? await ReservationService.updateStatus(row.dataset.recordId, selectedStatus)
                : await OrderService.updateStatus(row.dataset.recordId, selectedStatus);

            setMessage(result.ok ? 'Status updated.' : result.message, result.ok ? 'success' : 'error');
            if (result.ok) await load();
        } catch (_) {
            setMessage('Status update failed.', 'error');
        } finally {
            button.disabled = false;
        }
    });

    window.addEventListener('panadero-orders-changed', load);
    window.addEventListener('panadero-reservations-changed', load);
    load();
})();
