(function () {
    const dialog = document.getElementById('order-receipt-dialog');
    const body = document.getElementById('order-receipt-content');
    const PREFIX = 'panadero-receipt:';
    const formatMoney = number => '₱' + Number(number || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const paymentLabels = { cash: 'Cash', card: 'Card', gcash: 'GCash' };

    function userKey() {
        const user = window.AuthService && window.AuthService.getCurrentUser();
        return user && user.role === 'customer' ? String(user.id) : '';
    }
    function key(reference) {
        return PREFIX + userKey() + ':' + String(reference || '');
    }
    function remember(reference, details) {
        if (!userKey() || !reference) return;
        try { sessionStorage.setItem(key(reference), JSON.stringify(details)); } catch (_) {}
    }
    function recall(reference) {
        if (!userKey() || !reference) return null;
        try { return JSON.parse(sessionStorage.getItem(key(reference)) || 'null'); } catch (_) { return null; }
    }
    function create(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = String(text);
        return el;
    }
    function addDetail(container, label, value) {
        if (value === undefined || value === null || value === '') return;
        const row = create('div', 'receipt-detail-row');
        row.append(create('span', '', label), create('strong', '', value));
        container.appendChild(row);
    }
    function receiptReference(record) {
        return String(record.orderNumber || record.order_number || record.reference || '');
    }
    function open(record) {
        if (!dialog || !body || !record || !userKey()) return;
        const ref = receiptReference(record);
        if (!ref) return;
        const saved = recall(ref) || {};
        const items = Array.isArray(record.items) && record.items.length ? record.items : (saved.items || []);
        const total = Number.isFinite(Number(record.total)) ? Number(record.total) : Number(saved.total || 0);
        const when = record.createdAt || record.created_at || saved.createdAt;
        const name = [record.customer?.firstName, record.customer?.lastName].filter(Boolean).join(' ') || saved.name || '';
        const email = record.customer?.email || saved.email || '';
        body.textContent = '';
        const heading = create('div', 'receipt-brand');
        heading.append(create('span', 'receipt-brand-name', 'PANADERO'), create('span', '', 'Order Receipt'));
        body.appendChild(heading);
        const number = create('div', 'receipt-order-number');
        number.append(create('span', '', 'Order number'), create('strong', '', ref));
        body.appendChild(number);
        const details = create('div', 'receipt-details');
        addDetail(details, 'Date', when && !isNaN(Date.parse(when)) ? new Date(when).toLocaleString('en-PH', {dateStyle:'medium',timeStyle:'short'}) : '');
        addDetail(details, 'Customer', name);
        addDetail(details, 'Email', email);
        addDetail(details, 'Status', String(record.status || 'Pending'));
        const fulfillment = record.fulfillment || {};
        const fulfillmentMethod = fulfillment.method || saved.fulfillment;
        if (fulfillmentMethod === 'delivery') {
            addDetail(details, 'Method', 'Delivery');
            addDetail(details, 'Address', fulfillment.deliveryAddress || saved.deliveryAddress || '');
        } else if (fulfillmentMethod === 'pickup') {
            addDetail(details, 'Method', 'Pickup');
        }
        const payment = record.paymentMethod || saved.paymentMethod;
        if (payment && paymentLabels[payment]) addDetail(details, 'Selected payment method', paymentLabels[payment]);
        body.appendChild(details);
        const title = create('h3', 'receipt-items-heading', 'Order items');
        body.appendChild(title);
        const lines = create('div', 'receipt-items');
        for (const item of items) {
            const qty = Number(item.quantity || 0);
            const unitPrice = Number(item.price ?? item.unitPrice ?? 0);
            const lineTotal = Number(item.lineTotal ?? qty * unitPrice);
            const line = create('div', 'receipt-line');
            const description = create('div', 'receipt-item-name');
            description.append(create('strong', '', item.name || 'Product'), create('span', '', qty + ' × ' + formatMoney(unitPrice)));
            line.append(description, create('strong', '', formatMoney(lineTotal)));
            lines.appendChild(line);
        }
        body.appendChild(lines);
        const summary = create('div', 'receipt-total');
        summary.append(create('span', '', 'Total'), create('strong', '', formatMoney(total)));
        body.appendChild(summary);
        body.appendChild(create('p', 'receipt-footnote', 'Order received. Payment has not been confirmed by this receipt.'));
        if (!dialog.open) dialog.showModal();
    }
    if (dialog) {
        dialog.querySelectorAll('[data-receipt-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
        dialog.querySelector('[data-receipt-print]').addEventListener('click', () => window.print());
        dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    }
    window.OrderReceipt = { remember, open };
})();
