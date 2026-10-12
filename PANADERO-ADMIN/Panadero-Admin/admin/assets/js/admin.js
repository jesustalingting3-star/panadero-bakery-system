/* PANADERO Admin dashboard: role-based portal and MySQL-backed request status workflow. */
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

    function syncServer() {
        fetch((window.PANADERO_API || '/api') + '/admin/sync', { method: 'POST', headers: {'Content-Type':'application/json', ...(localStorage.getItem('panadero-api-token') ? {Authorization:'Bearer '+localStorage.getItem('panadero-api-token')} : {})}, body: JSON.stringify({categories: admin.categories, products: admin.products, users: admin.users, stocks: shared.stocks, orders: shared.orders, reservations: shared.reservations}) }).catch(() => {});
    }
    function persist() {
        sessionStorage.setItem(SHARED_KEY, JSON.stringify(shared));
        sessionStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
        // Database changes are handled by explicit authenticated API actions.
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

    const canonical = r => Object.assign({}, r, { status: r.status === 'processing' ? 'preparing' : r.status });
    const allRecords = () => shared.orders.map(o => canonical(Object.assign({}, o, { type: o.type === 'reservation' ? 'reservation' : 'order' })))
        .concat(shared.reservations.map(r => canonical(Object.assign({}, r, { type: 'reservation' }))))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const findRecord = (type, id) => { const r = (type === 'reservation' ? shared.reservations : shared.orders).find(r => String(r.id) === String(id)); if (r && r.status === 'processing') r.status = 'preparing'; return r; };
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
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            const values = {};
            fields.filter(f => f.type !== 'note').forEach(f => {
                const raw = form.elements[f.key].value;
                values[f.key] = f.type === 'number' ? (raw === '' ? NaN : Number(raw)) : raw.trim();
            });
            const submit = form.querySelector('button[type="submit"]');
            submit.disabled = true;
            try {
                const error = o.onSubmit ? await o.onSubmit(values) : null;
                if (error) { $('dialog-message').textContent = error; return; }
                closeDialog();
            } catch (error) {
                $('dialog-message').textContent = error.message || 'Unable to save changes.';
            } finally { submit.disabled = false; }
        });

        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    }

    const confirmBox = (heading, message, label, onYes) => openForm({
        eyebrow: 'Confirm', title: heading, message, submit: label, danger: true,
        onSubmit: async () => { await onYes(); }
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
        panel: ['Recent Orders & Reservations', 'Latest customer requests.',
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
        after: () => panel('Recent Baking Batches', 'Fresh batches recorded in inventory.',
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
        const i = FLOW.indexOf(r.status === 'processing' ? 'preparing' : r.status);
        const list = r.status === 'cancelled' ? ['cancelled'] : FLOW.filter((s, idx) => idx === i || (i >= 0 && idx === i + 1));
        return list.map(s => `<option value="${s}"${s === FLOW[i] ? ' selected' : ''}>${title(s)}</option>`).join('');
    }
    function scheduleText(r) {
        if (r.type === 'reservation') {
            const s = [r.schedule && r.schedule.preferredDate, r.schedule && r.schedule.preferredTime].filter(Boolean).join(' ');
            return escapeHtml(s || 'Not specified');
        }
        const f = r.fulfillment || {};
        const payment = ({cash:'Cash',card:'Card',gcash:'GCash'}[r.paymentMethod] || r.paymentMethod || '');
        return escapeHtml(title(f.method || 'pickup')) + (f.deliveryAddress ? `<br><small>${escapeHtml(f.deliveryAddress)}</small>` : '') + (payment ? `<br><small>Payment: ${escapeHtml(payment)}</small>` : '');
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
                        <td><div class="row-actions">${open ? '<button class="admin-small-button danger" type="button" data-action="cancel-record">Cancel</button>' : r.status === 'cancelled' ? '<button class="admin-small-button danger" type="button" data-action="delete-record">Delete</button>' : '—'}</div></td></tr>`;
                });
            return table(['Reference', 'Customer', 'Products', 'Details', 'Total', 'Status', 'Update', 'Admin'], rows, 'No orders or reservations match the selected filters.');
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
        panel: ['Accounts', 'Accounts created here are saved to MySQL and can sign in immediately.'],
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
        panel: ['Activity Log', 'Recent administrator actions saved in MySQL.'],
        toolbar: () => toolbar('cols-search-btn', searchBox('Search activity log...', 'Search activity log') +
            '<button class="admin-small-button danger" type="button" data-action="reset-data">Reset frontend data</button>'),
        table: () => {
            const q = ui.q.trim().toLowerCase();
            return table(['Time', 'Activity'], admin.logs.filter(l => !q || l.text.toLowerCase().includes(q)).slice(0, 100).map(l =>
                `<tr><td class="nowrap">${fmtDT(l.t)}</td><td>${escapeHtml(l.text)}</td></tr>`), 'No activity recorded.');
        }
    });

    /* ---------- Rendering ---------- */
    const NAV_ICONS = {
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="12" width="7" height="9" rx="1.5"/>',
        inventory: '<path d="M4 7h16M7 3h10l2 4H5l2-4Z"/><path d="M5 7h14v12H5zM9 11h6M9 15h6"/>',
        orders: '<path d="M7 3h10M7 7h10M7 11h10M7 15h6M5 21h14a2 2 0 0 0 2-2V5l-4-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"/>',
        customers: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/>',
        categories: '<path d="M3 6h18v14H3zM3 6l4-3h10l4 3M8 12h8"/>',
        users: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        logs: '<path d="M4 3h16v18H4zM8 7h8M8 11h8M8 15h5"/>',
        logout: '<path d="M10 17l-5-5 5-5M5 12h11M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4"/>'
    };
    const sidebarIcon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${NAV_ICONS[name] || NAV_ICONS.dashboard}</svg>`;
    const shell = $('admin-shell');
    shell.innerHTML = `
        <div class="admin-app-shell">
            <aside class="admin-sidebar" id="admin-sidebar" aria-label="Admin sidebar">
                <div class="admin-sidebar-brand">
                    <a href="#dashboard"><img src="assets/images/logo.jpg" alt="" width="52" height="52" onerror="this.onerror=null;this.src='assets/images/logo.svg'">PANADERO</a>
                    <span>Admin</span>
                </div>
                <nav class="admin-sidebar-nav" id="admin-navigation" aria-label="Admin navigation"></nav>
                <div class="admin-sidebar-account" aria-label="Admin account">
                    <span class="admin-account-avatar">${sidebarIcon('users')}</span>
                    <span class="admin-account-copy"><strong>Admin</strong><small>Account</small></span>
                </div>
                <button class="admin-sidebar-logout" type="button" id="admin-logout-button">${sidebarIcon('logout')}<span>Logout</span></button>
            </aside>
            <div class="admin-sidebar-backdrop" id="admin-sidebar-backdrop" hidden></div>
            <div class="admin-shell-main">
                <header class="admin-mobile-bar">
                    <button type="button" id="admin-menu-button" class="admin-menu-button" aria-controls="admin-sidebar" aria-label="Toggle admin navigation" aria-expanded="false">☰</button>
                </header>
                <main class="admin-main" id="admin-main"></main>
                <footer class="admin-home-footer"><a href="#dashboard" class="admin-footer-logo">PANADERO</a><p>Freshly baked. Simply delicious.</p><p class="admin-copyright">&copy; ${new Date().getFullYear()} PANADERO.</p></footer>
            </div>
        </div>`;

    const main = $('admin-main');
    const nav = $('admin-navigation');
    const menuButton = $('admin-menu-button');
    const sidebar = $('admin-sidebar');
    const backdrop = $('admin-sidebar-backdrop');
    let cur = null;

    function closeMenu() {
        document.body.classList.remove('admin-sidebar-open');
        backdrop.hidden = true;
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.textContent = '☰';
    }
    menuButton.addEventListener('click', () => {
        const open = !document.body.classList.contains('admin-sidebar-open');
        if (!open) return closeMenu();
        document.body.classList.add('admin-sidebar-open');
        backdrop.hidden = false;
        menuButton.setAttribute('aria-expanded', 'true');
        menuButton.textContent = '✕';
    });
    backdrop.addEventListener('click', closeMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    document.addEventListener('click', e => { if (innerWidth <= 920 && !sidebar.contains(e.target) && !menuButton.contains(e.target)) closeMenu(); });
    $('admin-logout-button').addEventListener('click', () => confirmBox('Log out?', 'You will return to the login page.', 'Logout', async () => {
        try {
            const token = localStorage.getItem('panadero-api-token');
            if (token) await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
        } catch (_) {}
        localStorage.removeItem('panadero-auth-session-v2');
        localStorage.removeItem('panadero-api-token');
        window.location.replace('/login.html');
    }));

    function render() {
        cur = V[ui.view]();
        nav.innerHTML = NAV.map(([key, label]) =>
            `<a class="admin-nav-link ${key === ui.view ? 'active' : ''}" href="#${key}"${key === ui.view ? ' aria-current="page"' : ''}><span class="admin-nav-icon">${sidebarIcon(key)}</span><span>${escapeHtml(label)}</span></a>`).join('');
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

    /* ---------- Database-backed Admin actions ---------- */
    const apiRoot = (window.PANADERO_API || '/api');
    const authHeaders = () => ({'Content-Type':'application/json', Authorization:'Bearer '+(localStorage.getItem('panadero-api-token') || '')});
    const imageId = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const originalImages = new Map(DATA.products.map(p => [imageId(p.name),p.image]));

    async function reloadDatabase() {
        const response = await fetch(apiRoot + '/admin/state', {headers:authHeaders(),cache:'no-store'});
        const state = await response.json();
        if (!response.ok || !state.ok) throw new Error(state.message || 'Could not load database changes.');
        admin.categories = state.categories || [];
        admin.products = (state.products || []).map(p => ({
            id:String(p.id), name:p.name, category:String(p.categoryId || p.category),
            price:Number(p.price), image:p.image || originalImages.get(imageId(p.name)) || DATA.fallbackImage
        }));
        admin.users = (state.users || []).map(user => ({...user, id:String(user.id), name:user.displayName || user.name || user.email}));
        admin.logs = state.logs || [];
        shared.orders = (state.orders || []).map(canonical);
        shared.reservations = (state.reservations || []).map(canonical);
        shared.batches = state.batches || [];
        shared.stocks = {};
        (state.products || []).forEach(p => {
            if (Number.isInteger(p.stock)) shared.stocks[String(p.id)] = {stock:p.stock,updatedAt:null};
        });
        render();
    }

    async function executeAction(action, data, message) {
        const response = await fetch(apiRoot + '/admin/action', {method:'POST',headers:authHeaders(),body:JSON.stringify({action,data})});
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'Unable to save changes.');
        await reloadDatabase();
        if (message) toast(message);
    }

    A['add-batch'] = () => {
        if (!admin.products.length) return toast('Add a product first.', true);
        openForm({
            eyebrow:'Inventory',title:'Add Fresh Batch',submit:'Save Batch',
            fields:[
                {key:'productId',label:'Product',type:'select',full:true,options:admin.products.map(p=>[p.id,p.name])},
                {key:'quantity',label:'Quantity Baked',type:'number',min:1,step:1,required:true},
                {key:'bakedDate',label:'Baked Date',type:'date',value:today(),max:today(),required:true},
                {key:'expirationDate',label:'Expiration Date',type:'date',value:addDays(2),required:true},
                {key:'notes',label:'Notes (Optional)',type:'textarea',full:true}
            ],
            onSubmit:async v=>{
                if (!product(v.productId) || !Number.isSafeInteger(v.quantity) || v.quantity < 1 || v.quantity > MAX_STOCK) return 'Choose a product and valid quantity.';
                if (!validDate(v.bakedDate) || !validDate(v.expirationDate) || v.bakedDate > today() || v.expirationDate < v.bakedDate) return 'Check the baking and expiration dates.';
                await executeAction('add-batch',v,'Fresh batch recorded.');
            }
        });
    };
    A['discard-batch'] = id => {
        const batch = shared.batches.find(b=>String(b.id)===String(id));
        if (!batch) return toast('Batch not found.',true);
        confirmBox('Discard batch?',`Discard ${batch.quantity} pcs of ${batch.productName}? Stock will be reduced if enough remains.`, 'Discard',
            ()=>executeAction('discard-batch',{id},'Batch discarded.'));
    };
    A['save-stock'] = (id,el,row) => {
        const input = row.querySelector('.stock-input');
        const stock = Number(input.value);
        if (input.value === '' || !Number.isSafeInteger(stock) || stock < 0 || stock > MAX_STOCK) return toast('Enter a whole stock quantity from 0 to 1,000,000.',true);
        const p = product(id);
        if (!p) return toast('Product not found.',true);
        confirmBox('Update stock?',`Set ${p.name} stock to ${stock}?`,'Update',()=>executeAction('save-stock',{id,stock},'Stock updated.'));
    };
    function productFields(p) {
        return [
            {key:'name',label:'Product Name',value:p?p.name:'',required:true,full:true},
            {key:'category',label:'Category',type:'select',options:admin.categories.map(c=>[c.id,c.name]),value:p?p.category:''},
            {key:'price',label:'Price (₱)',type:'number',min:0,step:'0.01',value:p?p.price:'',required:true}
        ];
    }
    function checkProduct(v,ignoreId) {
        if (!v.name || v.name.length > 100) return 'Enter a valid product name.';
        if (!Number.isFinite(v.price) || v.price < 0 || v.price > 1000000) return 'Enter a valid price.';
        if (!admin.categories.some(c=>String(c.id)===String(v.category))) return 'Choose a category.';
        if (admin.products.some(p=>p.id!==ignoreId && p.name.toLowerCase()===v.name.toLowerCase())) return 'Another product has that name.';
        return null;
    }
    A['add-product'] = () => {
        if (!admin.categories.length) return toast('Create a category first.',true);
        openForm({eyebrow:'Inventory',title:'Add Product',submit:'Add Product',fields:productFields(null),
            onSubmit:async v=>{const e=checkProduct(v);if(e)return e;await executeAction('add-product',v,'Product added. Stock is initially 0.');}});
    };
    A['edit-product'] = id => {
        const p=product(id);if(!p)return;
        openForm({eyebrow:'Inventory',title:'Edit Product',fields:productFields(p),
            onSubmit:async v=>{const e=checkProduct(v,id);if(e)return e;await executeAction('edit-product',{...v,id},'Product updated.');}});
    };
    A['delete-product'] = id => {
        const p=product(id);if(!p)return;
        confirmBox('Delete product?',`“${p.name}” will be deleted if no orders, reservations, or batches reference it.`, 'Delete',
            ()=>executeAction('delete-product',{id},'Product deleted.'));
    };
    async function patchRequestStatus(record,status) {
        const kind=record.type==='reservation'?'reservations':'orders';
        const response=await fetch(apiRoot+'/'+kind+'/'+encodeURIComponent(record.id)+'/status',
            {method:'PATCH',headers:authHeaders(),body:JSON.stringify({status})});
        const result=await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'Unable to update status.');
        await reloadDatabase();
    }
    A['save-status'] = (id,el,row) => {
        const record=findRecord(row.dataset.type,id);if(!record)return toast('Request not found.',true);
        const status=row.querySelector('.record-status-select').value;
        const next=FLOW[FLOW.indexOf(record.status)+1];
        if(status!==next)return toast('Choose the next status.',true);
        confirmBox('Update request status?',`${refNo(record)}: ${title(record.status)} → ${title(status)}.`, 'Update',async()=>{
            await patchRequestStatus(record,status);toast('Status updated.');
        });
    };
    A['cancel-record'] = (id,el,row) => {
        const record=findRecord(row.dataset.type,id);if(!record)return;
        confirmBox('Cancel request?',`${refNo(record)} will be cancelled, and reserved stock restored.`, 'Cancel',async()=>{
            await patchRequestStatus(record,'cancelled');toast('Request cancelled.');
        });
    };
    A['delete-record'] = (id,el,row) => {
        const record=findRecord(row.dataset.type,id);if(!record)return;
        confirmBox('Delete cancelled request?',`${refNo(record)} will be permanently deleted.`, 'Delete',
            ()=>executeAction(row.dataset.type==='reservation'?'delete-reservation':'delete-order',{id},'Cancelled request deleted.'));
    };
    A['add-category'] = () => openForm({eyebrow:'Categories',title:'Add Category',submit:'Add',fields:[{key:'name',label:'Category Name',required:true,full:true}],
        onSubmit:async v=>{if(!v.name||v.name.length>50)return 'Enter a name of up to 50 characters.';await executeAction('add-category',v,'Category added.');}});
    A['edit-category'] = id => {
        const c=admin.categories.find(c=>String(c.id)===String(id));if(!c)return;
        openForm({eyebrow:'Categories',title:'Rename Category',fields:[{key:'name',label:'Category Name',value:c.name,required:true,full:true}],
            onSubmit:async v=>{if(!v.name||v.name.length>50)return 'Enter a name of up to 50 characters.';await executeAction('edit-category',{...v,id},'Category renamed.');}});
    };
    A['delete-category'] = id => {
        const c=admin.categories.find(c=>String(c.id)===String(id));if(!c)return;
        if(admin.products.some(p=>String(p.category)===String(id)))return toast('Move or delete products in this category first.',true);
        confirmBox('Delete category?',`“${c.name}” will be removed.`, 'Delete',
            ()=>executeAction('delete-category',{id},'Category deleted.'));
    };
    A['add-user'] = () => openForm({eyebrow:'Users',title:'Add User',submit:'Create Account',
        fields:[{key:'name',label:'Full Name',required:true,full:true},
            {key:'email',label:'Email',type:'email',required:true},
            {key:'role',label:'Role',type:'select',options:ROLES,value:'staff'},
            {key:'password',label:'Initial Password (min 8 characters)',type:'password',required:true,full:true}],
        onSubmit:async v=>{if(v.password.length<8)return 'Password must contain at least 8 characters.';await executeAction('add-user',v,'User account created.');}});
    A['delete-user'] = id => {
        const u=admin.users.find(u=>String(u.id)===String(id));if(!u)return;
        confirmBox('Delete user?',`${u.name}'s account will be deleted if no records reference it.`, 'Delete',
            ()=>executeAction('delete-user',{id},'User deleted.'));
    };
    A['set-role'] = (id,el) => {
        const u=admin.users.find(u=>String(u.id)===String(id));if(!u||!ROLES.some(r=>r[0]===el.value))return;
        const newRole=el.value;if(newRole===u.role)return;
        render(); // Revert the visible dropdown until the confirmed database update succeeds.
        confirmBox('Change user role?',`${u.name}: ${title(u.role)} → ${title(newRole)}.`, 'Change Role',
            ()=>executeAction('set-role',{id,role:newRole},'User role changed.'));
    };
    A['reset-data'] = () => confirmBox('Clear cached admin view?',
        'This clears only cached browser information. MySQL records will not be deleted.','Clear Cache',()=>{
            sessionStorage.removeItem(SHARED_KEY);sessionStorage.removeItem(ADMIN_KEY);location.reload();
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
    reloadDatabase().catch(error => toast(error.message || 'Unable to load database.', true));
})();