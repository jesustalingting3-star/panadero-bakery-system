/* PANADERO Admin — frontend-only.
   Mirrors the Staff/Customer sites: same catalog (PANADERO_DATA), same lowercase status flow
   (pending -> preparing -> ready -> completed), same record shapes, and the same sessionStorage
   key for stocks / batches / orders / reservations ('panadero-staff-ui-v2').
   No fake orders are created. Backend developers can replace the store functions later. */
(function () {
    'use strict';

    /* ---------- Constants & helpers ---------- */
    const SHARED_KEY = 'panadero-staff-ui-v2';   // same key as the Staff pages
    const ADMIN_KEY = 'panadero-admin-ui-v1';    // admin-only data (catalog edits, users, logs)
    const FLOW = ['pending', 'preparing', 'ready', 'completed'];
    const ACTIVE = ['pending', 'preparing', 'ready'];
    const MAX_STOCK = 1000000;
    const ROLES = [['admin', 'Admin'], ['staff', 'Staff'], ['customer', 'Customer']];
    const DATA = window.PANADERO_DATA;

    const $ = id => document.getElementById(id);
    const clone = v => JSON.parse(JSON.stringify(v));
    const escapeHtml = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
    const money = v => '₱' + Number(v || 0).toFixed(2);
    const title = v => String(v || '').replace(/\b\w/g, c => c.toUpperCase());
    const pad = n => String(n).padStart(2, '0');
    const isoDate = d => [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-');
    const today = () => isoDate(new Date());
    const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
    const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00'));
    const fmtDT = t => t ? new Date(t).toLocaleString() : '—';
    const slugify = s => String(s).toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const makeId = prefix => (window.crypto && typeof window.crypto.randomUUID === 'function')
        ? window.crypto.randomUUID()
        : prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    const options = (list, selected) => list.map(([v, l]) =>
        `<option value="${escapeHtml(v)}"${String(selected) === String(v) ? ' selected' : ''}>${escapeHtml(l)}</option>`).join('');

    let toastTimer;
    function toast(message, isError) {
        const el = $('admin-toast');
        el.textContent = message;
        el.className = 'admin-toast show' + (isError ? ' error' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.className = 'admin-toast'; }, 3000);
    }

    /* ---------- State (sessionStorage, same as Staff) ---------- */
    function readJSON(key) {
        try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) { return null; }
    }

    let shared = readJSON(SHARED_KEY);
    if (!(shared && shared.stocks && Array.isArray(shared.batches) && Array.isArray(shared.orders) && Array.isArray(shared.reservations))) {
        shared = { stocks: {}, batches: [], orders: [], reservations: [] };
    }

    let admin = readJSON(ADMIN_KEY);
    if (!(admin && Array.isArray(admin.categories) && Array.isArray(admin.products))) {
        admin = {
            categories: clone(DATA.categories),
            products: DATA.products.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, image: p.image })),
            users: [],
            logs: []
        };
    }
    admin.users = Array.isArray(admin.users) ? admin.users : [];
    admin.logs = Array.isArray(admin.logs) ? admin.logs : [];

    function persist() {
        sessionStorage.setItem(SHARED_KEY, JSON.stringify(shared));
        sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    }

    // Run a change; if the browser can't store it, roll back (same behavior as the Staff data layer).
    function mutate(change) {
        const previous = JSON.stringify({ shared, admin });
        try {
            change();
            persist();
            return true;
        } catch (_) {
            const old = JSON.parse(previous);
            shared = old.shared; admin = old.admin;
            toast('Unable to retain changes in this browser.', true);
            return false;
        }
    }

    function log(text) {
        admin.logs.unshift({ t: new Date().toISOString(), text });
        admin.logs.length = Math.min(admin.logs.length, 200);
    }

    /* ---------- Catalog / inventory / record helpers ---------- */
    const product = id => admin.products.find(p => p.id === id) || null;
    const catName = id => (admin.categories.find(c => c.id === id) || { name: id }).name;
    const productName = item => item.name || (product(item.productId) || {}).name || 'Product';

    function inventoryItems() {
        return admin.products.map(p => {
            const saved = shared.stocks[p.id];
            return Object.assign({}, p, { stock: saved ? saved.stock : null, updatedAt: saved ? saved.updatedAt : null });
        });
    }
    function inventoryState(item) {
        if (!Number.isInteger(item.stock)) return 'not-set';
        return item.stock === 0 ? 'out-of-stock' : 'in-stock';
    }
    const STATE_LABEL = { 'not-set': 'Stock Not Set', 'out-of-stock': 'Out of Stock', 'in-stock': 'In Stock' };

    function batchState(b) {
        if (b.expirationDate < today()) return ['Expired', 'out-of-stock'];
        if (b.expirationDate <= addDays(1)) return ['Expiring Soon', 'pending'];
        return ['Fresh', 'ready'];
    }

    const allRecords = () => shared.orders.map(o => Object.assign({}, o, { type: o.type === 'reservation' ? 'reservation' : 'order' }))
        .concat(shared.reservations.map(r => Object.assign({}, r, { type: 'reservation' })))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const findRecord = (type, id) => (type === 'reservation' ? shared.reservations : shared.orders).find(r => r.id === id);
    const refNo = r => r.orderNumber || r.reservationNumber || r.id || '';
    const customerName = r => [r.customer && r.customer.firstName, r.customer && r.customer.lastName].filter(Boolean).join(' ') || 'Guest';

    /* ---------- Small HTML builders ---------- */
    const badge = (text, cls) => `<span class="status-badge ${escapeHtml(cls)}">${escapeHtml(text)}</span>`;

    function table(heads, rows, empty) {
        return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>` +
            `<tbody>${rows.join('')}</tbody></table>` +
            (rows.length ? '' : `<p class="admin-empty">${escapeHtml(empty || 'No records found.')}</p>`) + '</div>';
    }

    function panel(heading, sub, body, headerExtra) {
        return `<section class="admin-panel"><div class="admin-panel-header"><div><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(sub)}</p></div>${headerExtra || ''}</div>` +
            `<div class="admin-panel-body">${body}</div></section>`;
    }

    const metrics = list => `<section class="metric-grid" aria-label="Overview">${list.map(([label, value, note, small]) =>
        `<article class="metric-card"><span>${escapeHtml(label)}</span><strong class="${small ? 'small' : ''}">${escapeHtml(value)}</strong><small>${escapeHtml(note || '')}</small></article>`).join('')}</section>`;

    const toolbar = (cols, inner) => `<div class="admin-toolbar ${cols}">${inner}</div>`;
    const searchBox = (placeholder, label) =>
        `<input class="admin-field" type="search" data-filter="q" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(ui.q)}" autocomplete="off" aria-label="${escapeHtml(label)}">`;
    const filterSelect = (key, label, list) =>
        `<select class="admin-field" data-filter="${key}" aria-label="${escapeHtml(label)}">${options(list, ui[key])}</select>`;

    /* ---------- Dialog (native <dialog>, same look as Staff) ---------- */
    const dialog = $('admin-dialog');

    function fieldHTML(f) {
        if (f.type === 'note') return `<p class="admin-note full">${escapeHtml(f.text)}</p>`;
        const id = 'f-' + f.key;
        let control;
        if (f.type === 'select') {
            control = `<select class="admin-field" id="${id}" name="${f.key}">${options(f.options, f.value)}</select>`;
        } else if (f.type === 'textarea') {
            control = `<textarea class="admin-field" id="${id}" name="${f.key}" rows="3" maxlength="500">${escapeHtml(f.value || '')}</textarea>`;
        } else {
            control = `<input class="admin-field" id="${id}" name="${f.key}" type="${f.type || 'text'}" value="${escapeHtml(f.value == null ? '' : f.value)}"` +
                `${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}${f.step ? ` step="${f.step}"` : ''}` +
                `${f.required ? ' required' : ''} autocomplete="off">`;
        }
        return `<div class="admin-form-group${f.full ? ' full' : ''}"><label for="${id}">${escapeHtml(f.label)}</label>${control}</div>`;
    }

    function closeDialog() {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    function openForm(o) {
        const fields = o.fields || [];
        dialog.innerHTML = `
            <div class="admin-dialog-header">
                <div><p class="eyebrow">${escapeHtml(o.eyebrow || 'Admin')}</p><h2 id="dialog-title">${escapeHtml(o.title)}</h2></div>
                <button class="dialog-close" id="dialog-x" type="button" aria-label="Close">×</button>
            </div>
            <form id="dialog-form" novalidate>
                <div class="admin-form-grid">
                    ${o.message ? `<p class="admin-dialog-text">${escapeHtml(o.message)}</p>` : ''}
                    ${fields.map(fieldHTML).join('')}
                    <p class="admin-message error full" id="dialog-message" role="status"></p>
                    <div class="admin-form-actions">
                        <button class="admin-secondary" id="dialog-cancel" type="button">Cancel</button>
                        <button class="admin-primary${o.danger ? ' danger' : ''}" type="submit">${escapeHtml(o.submit || 'Save')}</button>
                    </div>
                </div>
            </form>`;

        const form = $('dialog-form');
        $('dialog-x').addEventListener('click', closeDialog);
        $('dialog-cancel').addEventListener('click', closeDialog);
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            const values = {};
            fields.filter(f => f.type !== 'note').forEach(f => {
                const raw = form.elements[f.key].value;
                values[f.key] = f.type === 'number' ? (raw === '' ? NaN : Number(raw)) : raw.trim();
            });
            const error = o.onSubmit ? o.onSubmit(values) : null;
            if (error) { $('dialog-message').textContent = error; return; }
            closeDialog();
        });

        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    }

    const confirmBox = (heading, message, label, onYes) => openForm({
        eyebrow: 'Confirm', title: heading, message, submit: label, danger: true,
        onSubmit: () => { onYes(); }
    });

    dialog.addEventListener('click', e => { if (e.target === dialog) closeDialog(); });

    /* ---------- Views ---------- */
    let ui = { view: 'dashboard', q: '', cat: 'all', avail: 'all', status: 'all', type: 'all' };
    const resetUi = view => { ui = { view, q: '', cat: 'all', avail: 'all', status: 'all', type: 'all' }; };

    const NAV = [
        ['dashboard', 'Dashboard'], ['inventory', 'Inventory & Batches'], ['orders', 'Orders & Reservations'],
        ['customers', 'Customers'], ['categories', 'Categories'], ['users', 'Users'], ['logs', 'Sales & Logs']
    ];

    const V = {};

    /* Dashboard */
    V.dashboard = () => ({
        title: 'Dashboard', sub: 'Overview of bakery operations.',
        action: '<a class="admin-primary" href="#inventory/batch">+ Add Fresh Batch</a>',
        metrics: () => {
            const items = inventoryItems();
            const records = allRecords();
            return metrics([
                ['Total Recorded Stock', String(items.reduce((s, i) => s + (Number.isInteger(i.stock) ? i.stock : 0), 0)), 'pieces across all products'],
                ['Pending Requests', String(records.filter(r => r.status === 'pending').length), 'orders and reservations'],
                ['Ready for Release', String(records.filter(r => r.status === 'ready').length), 'ready for customer pickup or delivery'],
                ['Inventory Needs Attention', String(items.filter(i => inventoryState(i) !== 'in-stock').length), 'out of stock or stock not set']
            ]);
        },
        panel: ['Recent Orders & Reservations', 'Customer requests will appear here once connected to the shared system data.',
            '<a class="admin-secondary" href="#orders">View All</a>'],
        table: () => table(['Reference', 'Type', 'Customer', 'Total', 'Status', 'Submitted'],
            allRecords().slice(0, 8).map(r => `<tr><td><strong>${escapeHtml(refNo(r))}</strong></td>
                <td>${r.type === 'reservation' ? 'Reservation' : 'Order'}</td><td>${escapeHtml(customerName(r))}</td>
                <td>${money(r.total)}</td><td>${badge(r.status, r.status)}</td><td>${fmtDT(r.createdAt)}</td></tr>`),
            'No customer requests yet.')
    });

    /* Inventory & batches */
    function filteredItems() {
        const q = ui.q.trim().toLowerCase();
        return inventoryItems().filter(i => (!q || i.name.toLowerCase().includes(q)) &&
            (ui.cat === 'all' || i.category === ui.cat) && (ui.avail === 'all' || inventoryState(i) === ui.avail));
    }

    V.inventory = () => ({
        title: 'Inventory & Fresh Batches', sub: 'Record newly baked products, maintain stock quantities, and manage product details.',
        action: '<button class="admin-primary" type="button" data-action="add-batch">+ Add Fresh Batch</button>',
        metrics: () => {
            const batches = shared.batches;
            const states = batches.map(batchState);
            return metrics([
                ['Batches Logged', String(batches.length), 'recorded this session'],
                ['Baked Today', String(batches.filter(b => b.bakedDate === today()).reduce((s, b) => s + b.quantity, 0)), 'pieces'],
                ['Expiring Soon', String(states.filter(s => s[0] === 'Expiring Soon').length), 'expire today or tomorrow'],
                ['Expired', String(states.filter(s => s[0] === 'Expired').length), 'should be discarded']
            ]);
        },
        panel: ['Product Inventory', 'Search products, filter the table, update stock, and edit product details.',
            '<button class="admin-secondary" type="button" data-action="add-product">+ Add Product</button>'],
        toolbar: () => toolbar('', searchBox('Search a product...', 'Search inventory') +
            filterSelect('cat', 'Filter category', [['all', 'All Categories'], ...admin.categories.map(c => [c.id, c.name])]) +
            filterSelect('avail', 'Filter availability', [['all', 'All Availability'], ['in-stock', 'In Stock'], ['out-of-stock', 'Out of Stock'], ['not-set', 'Stock Not Set']])),
        table: () => table(['Product', 'Category', 'Price', 'Availability', 'Stock Quantity', 'Last Updated', 'Manage'],
            filteredItems().map(i => {
                const state = inventoryState(i);
                return `<tr data-id="${escapeHtml(i.id)}">
                    <td><div class="admin-table-product"><img src="${escapeHtml(i.image || DATA.fallbackImage)}" alt="" loading="lazy"><strong>${escapeHtml(i.name)}</strong></div></td>
                    <td>${escapeHtml(catName(i.category))}</td><td>${money(i.price)}</td>
                    <td>${badge(STATE_LABEL[state], state)}</td>
                    <td><div class="stock-editor"><input class="admin-field stock-input" type="number" min="0" step="1" value="${Number.isInteger(i.stock) ? i.stock : ''}" placeholder="Not set" aria-label="Stock for ${escapeHtml(i.name)}"><button class="admin-small-button" type="button" data-action="save-stock">Save</button></div></td>
                    <td>${fmtDT(i.updatedAt)}</td>
                    <td><div class="row-actions"><button class="admin-small-button" type="button" data-action="edit-product">Edit</button><button class="admin-small-button danger" type="button" data-action="delete-product">Delete</button></div></td></tr>`;
            }), 'No products match the selected filters.'),
        after: () => panel('Recent Baking Batches', 'Fresh batches recorded during this browser session.',
            shared.batches.length ? `<div class="batch-list">${shared.batches.slice(0, 10).map(b => {
                const [label, cls] = batchState(b);
                return `<article class="batch-row" data-id="${escapeHtml(b.id)}">
                    <div><strong>${escapeHtml(b.productName)}</strong><small>${escapeHtml(b.notes || 'Fresh baking batch')}</small></div>
                    <div><strong>${b.quantity} pcs</strong><small>Quantity</small></div>
                    <div><strong>${escapeHtml(b.bakedDate)}</strong><small>Baked</small></div>
                    <div><strong>${escapeHtml(b.expirationDate)}</strong><small>Expires</small></div>
                    <div>${badge(label, cls)}<small><button class="admin-small-button danger" type="button" data-action="discard-batch">Discard</button></small></div></article>`;
            }).join('')}</div>` : '<p class="admin-empty">No batches recorded yet.</p>')
    });

    /* Orders & reservations */
    function statusOptions(r) {
        const i = FLOW.indexOf(r.status);
        const list = r.status === 'cancelled' ? ['cancelled'] : FLOW.filter((s, idx) => s === r.status || (i >= 0 && idx === i + 1));
        return list.map(s => `<option value="${s}"${s === r.status ? ' selected' : ''}>${title(s)}</option>`).join('');
    }
    function scheduleText(r) {
        if (r.type === 'reservation') {
            const s = [r.schedule && r.schedule.preferredDate, r.schedule && r.schedule.preferredTime].filter(Boolean).join(' ');
            return escapeHtml(s || 'Not specified');
        }
        const f = r.fulfillment || {};
        const when = [f.preferredDate, f.preferredTime].filter(Boolean).join(' ');
        return escapeHtml(title(f.method || 'pickup')) + (f.deliveryAddress ? `<br><small>${escapeHtml(f.deliveryAddress)}</small>` : '') + (when ? `<br><small>${escapeHtml(when)}</small>` : '');
    }
    function searchable(r) {
        const c = r.customer || {};
        return [r.orderNumber, r.reservationNumber, c.firstName, c.lastName, c.email].concat((r.items || []).map(productName)).join(' ').toLowerCase();
    }

    V.orders = () => ({
        title: 'Orders & Reservations', sub: 'Process customer requests, update statuses, and cancel or remove records.',
        metrics: () => {
            const records = allRecords();
            return metrics([['Pending', 'pending'], ['Preparing', 'preparing'], ['Ready', 'ready'], ['Completed', 'completed']]
                .map(([label, s]) => [label, String(records.filter(r => r.status === s).length), 'requests']));
        },
        panel: ['Customer Requests', 'Search or filter, then move requests through Pending → Preparing → Ready → Completed.'],
        toolbar: () => toolbar('', searchBox('Search reference, customer, or product...', 'Search customer requests') +
            filterSelect('type', 'Filter request type', [['all', 'Orders & Reservations'], ['order', 'Orders Only'], ['reservation', 'Reservations Only']]) +
            filterSelect('status', 'Filter status', [['all', 'All Statuses'], ...FLOW.map(s => [s, title(s)]), ['cancelled', 'Cancelled']])),
        table: () => {
            const q = ui.q.trim().toLowerCase();
            const rows = allRecords().filter(r => (!q || searchable(r).includes(q)) && (ui.type === 'all' || r.type === ui.type) && (ui.status === 'all' || r.status === ui.status))
                .map(r => {
                    const open = ACTIVE.includes(r.status);
                    const c = r.customer || {};
                    return `<tr data-id="${escapeHtml(r.id)}" data-type="${r.type}">
                        <td><strong>${escapeHtml(refNo(r))}</strong><div class="order-items">${r.type === 'reservation' ? 'Reservation' : 'Order'}${r.createdAt ? '<br>' + escapeHtml(fmtDT(r.createdAt)) : ''}</div></td>
                        <td><div class="order-customer"><strong>${escapeHtml(customerName(r))}</strong><span>${escapeHtml(c.email || '')}</span><span>${escapeHtml(c.mobile || '')}</span></div></td>
                        <td><div class="order-items">${(r.items || []).map(i => escapeHtml(productName(i)) + ' × ' + escapeHtml(i.quantity)).join('<br>')}</div></td>
                        <td>${scheduleText(r)}</td><td><strong>${money(r.total)}</strong></td><td>${badge(r.status, r.status)}</td>
                        <td><div class="stock-editor"><select class="admin-field compact record-status-select" aria-label="Status for ${escapeHtml(refNo(r))}"${open ? '' : ' disabled'}>${statusOptions(r)}</select><button class="admin-small-button" type="button" data-action="save-status"${r.status === 'completed' || r.status === 'cancelled' ? ' disabled' : ''}>Save</button></div></td>
                        <td><div class="row-actions">${open ? '<button class="admin-small-button danger" type="button" data-action="cancel-record">Cancel</button>' : '<button class="admin-small-button danger" type="button" data-action="delete-record">Delete</button>'}</div></td></tr>`;
                });
            return table(['Reference', 'Customer', 'Products', 'Schedule', 'Total', 'Status', 'Update', 'Admin'], rows, 'No orders or reservations match the selected filters.');
        }
    });

    /* Customers (derived from requests; read-only) */
    V.customers = () => ({
        title: 'Customers', sub: 'Customers who have placed an order or reservation.',
        metrics: () => metrics([['Customers', String(customerList().length), 'with at least one request']]),
        panel: ['Customer Activity', 'Totals are calculated from the shared orders and reservations.'],
        toolbar: () => toolbar('cols-1', searchBox('Search customer...', 'Search customers')),
        table: () => {
            const q = ui.q.trim().toLowerCase();
            return table(['Name', 'Email', 'Mobile', 'Total Requests', 'Active', 'Total Spent'],
                customerList().filter(c => !q || (c.name + ' ' + c.email).toLowerCase().includes(q)).map(c =>
                    `<tr><td><strong>${escapeHtml(c.name)}</strong></td><td>${escapeHtml(c.email)}</td><td>${escapeHtml(c.mobile)}</td><td>${c.total}</td><td>${c.active}</td><td>${money(c.spent)}</td></tr>`),
                'No customers yet.');
        }
    });
    function customerList() {
        const map = new Map();
        allRecords().forEach(r => {
            const c = r.customer || {};
            const key = String(c.email || customerName(r)).toLowerCase();
            if (!map.has(key)) map.set(key, { name: customerName(r), email: c.email || '', mobile: c.mobile || '', total: 0, active: 0, spent: 0 });
            const m = map.get(key);
            m.total++;
            if (ACTIVE.includes(r.status)) m.active++;
            if (r.status === 'completed') m.spent += Number(r.total) || 0;
        });
        return Array.from(map.values());
    }

    /* Categories */
    V.categories = () => ({
        title: 'Bread Categories', sub: 'Add, rename, or remove product categories.',
        action: '<button class="admin-primary" type="button" data-action="add-category">+ Add Category</button>',
        panel: ['Categories', 'A category can only be deleted when it has no products.'],
        table: () => table(['Category', 'Products', 'Manage'], admin.categories.map(c =>
            `<tr data-id="${escapeHtml(c.id)}"><td><strong>${escapeHtml(c.name)}</strong></td><td>${admin.products.filter(p => p.category === c.id).length}</td>
             <td><div class="row-actions"><button class="admin-small-button" type="button" data-action="edit-category">Rename</button><button class="admin-small-button danger" type="button" data-action="delete-category">Delete</button></div></td></tr>`),
            'No categories yet.')
    });

    /* Users */
    V.users = () => ({
        title: 'User Accounts', sub: 'Manage Admin, Staff, and Customer accounts.',
        action: '<button class="admin-primary" type="button" data-action="add-user">+ Add User</button>',
        panel: ['Accounts', 'Frontend-only list. Real sign-in is handled by the shared login once the backend is connected.'],
        table: () => table(['Name', 'Email', 'Role', 'Manage'], admin.users.map(u =>
            `<tr data-id="${escapeHtml(u.id)}"><td><strong>${escapeHtml(u.name)}</strong></td><td>${escapeHtml(u.email)}</td>
             <td><select class="admin-field compact" data-change="set-role" aria-label="Role for ${escapeHtml(u.name)}">${options(ROLES, u.role)}</select></td>
             <td><button class="admin-small-button danger" type="button" data-action="delete-user">Delete</button></td></tr>`),
            'No user accounts yet. Use “+ Add User” to create one.')
    });

    /* Sales & logs */
    V.logs = () => ({
        title: 'Sales & Activity Logs', sub: 'Completed sales and a record of admin actions.',
        metrics: () => {
            const records = allRecords();
            const done = records.filter(r => r.status === 'completed');
            const sold = {};
            done.forEach(r => (r.items || []).forEach(i => { const n = productName(i); sold[n] = (sold[n] || 0) + (Number(i.quantity) || 0); }));
            const top = Object.entries(sold).sort((a, b) => b[1] - a[1])[0];
            return metrics([
                ['Total Sales', money(done.reduce((s, r) => s + (Number(r.total) || 0), 0)), 'from completed requests', true],
                ['Completed Requests', String(done.length), 'orders and reservations'],
                ['Cancelled Requests', String(records.filter(r => r.status === 'cancelled').length), 'orders and reservations'],
                ['Top Seller', top ? `${top[0]} (${top[1]})` : '—', 'by pieces sold', true]
            ]);
        },
        panel: ['Activity Log', 'Most recent admin actions in this browser session.'],
        toolbar: () => toolbar('cols-search-btn', searchBox('Search activity log...', 'Search activity log') +
            '<button class="admin-small-button danger" type="button" data-action="reset-data">Reset frontend data</button>'),
        table: () => {
            const q = ui.q.trim().toLowerCase();
            return table(['Time', 'Activity'], admin.logs.filter(l => !q || l.text.toLowerCase().includes(q)).slice(0, 100).map(l =>
                `<tr><td class="nowrap">${fmtDT(l.t)}</td><td>${escapeHtml(l.text)}</td></tr>`), 'No activity recorded.');
        }
    });

    /* ---------- Rendering ---------- */
    const shell = $('admin-shell');
    shell.innerHTML = `
        <header class="admin-home-header"><div class="admin-header-container">
            <a class="admin-home-logo" href="#dashboard">PANADERO<span>Admin Portal</span></a>
            <button type="button" id="admin-menu-button" class="admin-menu-button" aria-controls="admin-navigation" aria-label="Toggle admin navigation" aria-expanded="false">☰</button>
            <nav class="admin-home-nav" id="admin-navigation" aria-label="Admin navigation"></nav>
        </div></header>
        <main class="admin-main" id="admin-main"></main>
        <footer class="admin-home-footer">
            <a href="#dashboard" class="admin-footer-logo">PANADERO</a>
            <p>Freshly baked. Simply delicious.</p>
            <p class="admin-copyright">&copy; ${new Date().getFullYear()} PANADERO.</p>
        </footer>`;

    const main = $('admin-main');
    const nav = $('admin-navigation');
    const menuButton = $('admin-menu-button');
    let cur = null;

    function closeMenu() {
        nav.classList.remove('show');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.textContent = '☰';
    }
    menuButton.addEventListener('click', () => {
        const open = nav.classList.toggle('show');
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.textContent = open ? '✕' : '☰';
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    document.addEventListener('click', e => { if (!nav.contains(e.target) && !menuButton.contains(e.target)) closeMenu(); });

    function render() {
        cur = V[ui.view]();
        nav.innerHTML = NAV.map(([key, label]) =>
            `<a class="${key === ui.view ? 'active' : ''}" href="#${key}"${key === ui.view ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`).join('');
        const [pTitle, pSub, pExtra] = cur.panel || [];
        main.innerHTML = `
            <header class="admin-page-heading"><div><p class="eyebrow">Admin Portal</p><h1>${escapeHtml(cur.title)}</h1><p>${escapeHtml(cur.sub)}</p></div>${cur.action || ''}</header>
            ${cur.metrics ? cur.metrics() : ''}
            ${panel(pTitle, pSub, (cur.toolbar ? cur.toolbar() : '') + `<div id="tablebox">${cur.table()}</div>`, pExtra)}
            ${cur.after ? cur.after() : ''}`;
    }
    const refreshTable = () => { if (cur && $('tablebox')) $('tablebox').innerHTML = cur.table(); };
    const commit = message => { render(); if (message) toast(message); };

    function route() {
        const [view, arg] = (location.hash.slice(1) || 'dashboard').split('/');
        const key = V[view] ? view : 'dashboard';
        if (key !== ui.view) resetUi(key);
        closeMenu();
        render();
        if (key === 'inventory' && arg === 'batch') {
            history.replaceState(null, '', '#inventory');
            A['add-batch']();
        }
    }

    /* ---------- Actions ---------- */
    const A = {};

    /* Batches & stock */
    A['add-batch'] = () => {
        if (!admin.products.length) return toast('Add a product first.', true);
        openForm({
            eyebrow: 'Inventory', title: 'Add Fresh Batch', submit: 'Save Batch',
            fields: [
                { key: 'productId', label: 'Product', type: 'select', full: true, options: admin.products.map(p => [p.id, p.name]) },
                { key: 'quantity', label: 'Quantity Baked', type: 'number', min: 1, step: 1, required: true },
                { key: 'bakedDate', label: 'Baked Date', type: 'date', value: today(), max: today(), required: true },
                { key: 'expirationDate', label: 'Expiration Date', type: 'date', value: addDays(2), required: true },
                { key: 'notes', label: 'Notes (Optional)', type: 'textarea', full: true }
            ],
            onSubmit: v => {
                const p = product(v.productId);
                if (!p || !Number.isSafeInteger(v.quantity) || v.quantity < 1 || v.quantity > MAX_STOCK) return 'Choose a product and enter a whole quantity from 1 to 1,000,000.';
                if (!validDate(v.bakedDate) || !validDate(v.expirationDate)) return 'Enter valid baked and expiration dates.';
                if (v.bakedDate > today()) return 'The baked date cannot be later than today.';
                if (v.expirationDate < v.bakedDate) return 'The expiration date cannot be earlier than the baked date.';
                const current = shared.stocks[p.id] ? shared.stocks[p.id].stock : 0;
                if (current + v.quantity > MAX_STOCK) return 'Total stock cannot exceed 1,000,000.';
                const ok = mutate(() => {
                    shared.batches.unshift({ id: makeId('batch'), productId: p.id, productName: p.name, quantity: v.quantity, bakedDate: v.bakedDate, expirationDate: v.expirationDate, notes: v.notes.slice(0, 500) });
                    shared.stocks[p.id] = { stock: current + v.quantity, updatedAt: new Date().toISOString() };
                    log(`Added batch of ${v.quantity} × ${p.name} (expires ${v.expirationDate})`);
                });
                if (!ok) return 'Unable to save this batch.';
                commit(`Batch recorded – ${p.name} stock is now ${current + v.quantity}`);
            }
        });
    };

    A['discard-batch'] = (id) => {
        const b = shared.batches.find(x => x.id === id);
        if (!b) return;
        confirmBox('Discard batch?', `${b.quantity} × ${b.productName} will be removed and deducted from stock.`, 'Discard', () => {
            if (mutate(() => {
                shared.batches = shared.batches.filter(x => x.id !== id);
                if (shared.stocks[b.productId]) shared.stocks[b.productId] = { stock: Math.max(0, shared.stocks[b.productId].stock - b.quantity), updatedAt: new Date().toISOString() };
                log(`Discarded batch of ${b.quantity} × ${b.productName}`);
            })) commit('Batch discarded');
        });
    };

    A['save-stock'] = (id, el, row) => {
        const input = row.querySelector('.stock-input');
        const stock = Number(input.value);
        if (input.value === '') return toast('Enter a stock quantity before saving.', true);
        if (!product(id) || !Number.isSafeInteger(stock) || stock < 0 || stock > MAX_STOCK) return toast('Enter a whole stock quantity from 0 to 1,000,000.', true);
        const before = shared.stocks[id] ? shared.stocks[id].stock : 'not set';
        if (mutate(() => {
            shared.stocks[id] = { stock, updatedAt: new Date().toISOString() };
            log(`Stock for ${product(id).name}: ${before} → ${stock}`);
        })) commit('Stock updated.');
    };

    /* Products */
    function productFields(p) {
        return [
            { key: 'name', label: 'Product Name', value: p ? p.name : '', required: true, full: true },
            { key: 'category', label: 'Category', type: 'select', options: admin.categories.map(c => [c.id, c.name]), value: p ? p.category : '' },
            { key: 'price', label: 'Price (₱)', type: 'number', min: 0, step: '0.01', value: p ? p.price : '', required: true },
            { key: 'image', label: 'Image URL (Optional)', type: 'url', value: p ? p.image || '' : '', full: true }
        ];
    }
    function checkProduct(v, ignoreId) {
        if (!v.name) return 'Enter a product name.';
        if (!Number.isFinite(v.price) || v.price < 0 || v.price > 1000000) return 'Enter a valid price.';
        if (!admin.categories.some(c => c.id === v.category)) return 'Choose a category.';
        if (admin.products.some(x => x.id !== ignoreId && x.name.toLowerCase() === v.name.toLowerCase())) return 'Another product already uses that name.';
        return null;
    }

    A['add-product'] = () => {
        if (!admin.categories.length) return toast('Create a category first.', true);
        openForm({
            eyebrow: 'Inventory', title: 'Add Product', submit: 'Add Product', fields: productFields(null),
            onSubmit: v => {
                const error = checkProduct(v, null);
                if (error) return error;
                let id = slugify(v.name) || 'product', n = 2;
                while (product(id)) id = slugify(v.name) + '-' + n++;
                if (mutate(() => {
                    admin.products.push({ id, name: v.name, category: v.category, price: v.price, image: v.image });
                    log(`Added product ${v.name} (${money(v.price)})`);
                })) commit('Product added. Stock is “not set” until you add a batch or save a quantity.');
            }
        });
    };

    A['edit-product'] = (id) => {
        const p = product(id);
        if (!p) return;
        openForm({
            eyebrow: 'Inventory', title: 'Edit Product', fields: productFields(p),
            onSubmit: v => {
                const error = checkProduct(v, id);
                if (error) return error;
                const changes = [];
                if (v.price !== p.price) changes.push(`price ${money(p.price)} → ${money(v.price)}`);
                if (v.name !== p.name) changes.push(`renamed from ${p.name}`);
                if (v.category !== p.category) changes.push(`category → ${catName(v.category)}`);
                if (mutate(() => {
                    shared.batches.forEach(b => { if (b.productId === id) b.productName = v.name; });
                    Object.assign(p, { name: v.name, category: v.category, price: v.price, image: v.image });
                    log(`Updated ${v.name}${changes.length ? ': ' + changes.join(', ') : ' (no changes)'}`);
                })) commit('Product updated.');
            }
        });
    };

    A['delete-product'] = (id) => {
        const p = product(id);
        if (!p) return;
        const open = allRecords().filter(r => ACTIVE.includes(r.status) && (r.items || []).some(i => i.productId === id)).length;
        confirmBox('Delete product?', `“${p.name}” will be removed from the catalog.` + (open ? ` ${open} active request(s) still reference it.` : ''), 'Delete', () => {
            if (mutate(() => {
                admin.products = admin.products.filter(x => x.id !== id);
                delete shared.stocks[id];
                log(`Deleted product ${p.name}`);
            })) commit('Product deleted.');
        });
    };

    /* Orders & reservations */
    A['save-status'] = (id, el, row) => {
        const record = findRecord(row.dataset.type, id);
        if (!record) return toast('Request not found.', true);
        const status = row.querySelector('.record-status-select').value;
        if (status === record.status) return toast('Choose the next status first.', true);
        const next = FLOW[FLOW.indexOf(record.status) + 1];
        if (status !== next) return toast('Choose the next status in the workflow.', true);
        const from = record.status;
        if (mutate(() => {
            record.status = status;
            record.updatedAt = new Date().toISOString();
            log(`${title(row.dataset.type)} ${refNo(record)}: ${from} → ${status}`);
        })) commit(`${refNo(record) || 'Request'} is now ${status}.`);
    };

    A['cancel-record'] = (id, el, row) => {
        const record = findRecord(row.dataset.type, id);
        if (!record) return;
        confirmBox('Cancel request?', `${title(row.dataset.type)} ${refNo(record)} for ${customerName(record)} will be marked as cancelled.`, 'Cancel Request', () => {
            if (mutate(() => {
                record.status = 'cancelled';
                record.updatedAt = new Date().toISOString();
                log(`Cancelled ${row.dataset.type} ${refNo(record)}`);
            })) commit('Request cancelled.');
        });
    };

    A['delete-record'] = (id, el, row) => {
        const type = row.dataset.type;
        const record = findRecord(type, id);
        if (!record) return;
        confirmBox('Delete record?', `${title(type)} ${refNo(record)} will be permanently removed.`, 'Delete', () => {
            if (mutate(() => {
                if (type === 'reservation') shared.reservations = shared.reservations.filter(r => r.id !== id);
                else shared.orders = shared.orders.filter(r => r.id !== id);
                log(`Deleted ${type} record ${refNo(record)}`);
            })) commit('Record deleted.');
        });
    };

    /* Categories */
    A['add-category'] = () => openForm({
        eyebrow: 'Categories', title: 'Add Category', submit: 'Add', fields: [{ key: 'name', label: 'Category Name', required: true, full: true }],
        onSubmit: v => {
            if (!v.name) return 'Enter a category name.';
            if (admin.categories.some(c => c.name.toLowerCase() === v.name.toLowerCase())) return 'That category already exists.';
            let id = slugify(v.name) || 'category', n = 2;
            while (admin.categories.some(c => c.id === id)) id = slugify(v.name) + '-' + n++;
            if (mutate(() => { admin.categories.push({ id, name: v.name }); log(`Added category ${v.name}`); })) commit('Category added.');
        }
    });

    A['edit-category'] = (id) => {
        const c = admin.categories.find(x => x.id === id);
        if (!c) return;
        openForm({
            eyebrow: 'Categories', title: 'Rename Category', fields: [{ key: 'name', label: 'Category Name', value: c.name, required: true, full: true }],
            onSubmit: v => {
                if (!v.name) return 'Enter a category name.';
                if (admin.categories.some(x => x.id !== id && x.name.toLowerCase() === v.name.toLowerCase())) return 'That category already exists.';
                const old = c.name;
                if (mutate(() => { c.name = v.name; log(`Renamed category ${old} → ${v.name}`); })) commit('Category renamed.');
            }
        });
    };

    A['delete-category'] = (id) => {
        const c = admin.categories.find(x => x.id === id);
        if (!c) return;
        const count = admin.products.filter(p => p.category === id).length;
        if (count) return toast(`“${c.name}” still has ${count} product(s). Move or delete them first.`, true);
        confirmBox('Delete category?', `“${c.name}” will be removed.`, 'Delete', () => {
            if (mutate(() => { admin.categories = admin.categories.filter(x => x.id !== id); log(`Deleted category ${c.name}`); })) commit('Category deleted.');
        });
    };

    /* Users */
    A['add-user'] = () => openForm({
        eyebrow: 'Users', title: 'Add User', submit: 'Add User',
        fields: [
            { key: 'name', label: 'Full Name', required: true, full: true },
            { key: 'email', label: 'Email', type: 'email', required: true },
            { key: 'role', label: 'Role', type: 'select', options: ROLES, value: 'staff' }
        ],
        onSubmit: v => {
            if (!v.name) return 'Enter a full name.';
            if (admin.users.some(u => u.email.toLowerCase() === v.email.toLowerCase())) return 'That email is already registered.';
            if (mutate(() => {
                admin.users.push({ id: makeId('user'), name: v.name, email: v.email, role: v.role });
                log(`Created ${title(v.role)} account for ${v.name}`);
            })) commit('User added.');
        }
    });

    A['delete-user'] = (id) => {
        const u = admin.users.find(x => x.id === id);
        if (!u) return;
        confirmBox('Delete user?', `${u.name}'s account will be removed.`, 'Delete', () => {
            if (mutate(() => { admin.users = admin.users.filter(x => x.id !== id); log(`Deleted account ${u.name}`); })) commit('User deleted.');
        });
    };

    A['set-role'] = (id, el) => {
        const u = admin.users.find(x => x.id === id);
        if (!u || !ROLES.some(r => r[0] === el.value)) return;
        const old = u.role;
        if (mutate(() => { u.role = el.value; log(`Changed ${u.name}'s role: ${title(old)} → ${title(el.value)}`); })) commit('Role updated.');
    };

    A['reset-data'] = () => confirmBox('Reset frontend data?',
        'This clears the stocks, batches, orders, reservations, users, catalog edits, and logs saved in this browser session.', 'Reset', () => {
            try { sessionStorage.removeItem(SHARED_KEY); sessionStorage.removeItem(ADMIN_KEY); } catch (_) { /* ignore */ }
            location.hash = '#dashboard';
            location.reload();
        });

    /* ---------- Events (delegated) ---------- */
    main.addEventListener('click', e => {
        const el = e.target.closest('[data-action]');
        if (!el || el.disabled || !A[el.dataset.action]) return;
        const row = el.closest('[data-id]');
        A[el.dataset.action](row ? row.dataset.id : null, el, row);
    });
    main.addEventListener('input', e => {
        const key = e.target.dataset && e.target.dataset.filter;
        if (key && e.target.tagName === 'INPUT') { ui[key] = e.target.value; refreshTable(); }
    });
    main.addEventListener('change', e => {
        const el = e.target;
        if (el.dataset && el.dataset.filter && el.tagName === 'SELECT') { ui[el.dataset.filter] = el.value; refreshTable(); }
        if (el.dataset && el.dataset.change && A[el.dataset.change]) {
            const row = el.closest('[data-id]');
            A[el.dataset.change](row ? row.dataset.id : null, el, row);
        }
    });
    // Broken product image -> same fallback as Staff/Customer pages
    document.addEventListener('error', e => {
        const img = e.target;
        if (img && img.tagName === 'IMG' && !img.dataset.fallbackApplied) {
            img.dataset.fallbackApplied = 'true';
            img.src = DATA.fallbackImage;
        }
    }, true);

    window.addEventListener('hashchange', route);
    route();
})();