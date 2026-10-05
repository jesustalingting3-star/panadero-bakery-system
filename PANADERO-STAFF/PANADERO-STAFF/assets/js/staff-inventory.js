(function () {
    const table = document.getElementById('inventory-table');
    if (!table) return;

    const search = document.getElementById('inventory-search');
    const categoryFilter = document.getElementById('inventory-category');
    const statusFilter = document.getElementById('inventory-status');
    const empty = document.getElementById('inventory-empty');
    const message = document.getElementById('inventory-message');
    const dialog = document.getElementById('batch-dialog');
    const form = document.getElementById('batch-form');
    const productSelect = document.getElementById('batch-product');
    const batchList = document.getElementById('batch-list');
    const batchEmpty = document.getElementById('batch-empty');
    const batchMessage = document.getElementById('batch-message');

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
        }[character]));
    }

    function setMessage(element, text, type) {
        if (!element) return;
        element.textContent = text || '';
        element.className = 'staff-message' + (element === batchMessage ? ' full' : '') + (type ? ' ' + type : '');
    }

    function inventoryState(item) {
        if (!Number.isInteger(item.stock)) return 'not-set';
        return item.stock === 0 ? 'out-of-stock' : 'in-stock';
    }

    function stateLabel(state) {
        return {
            'not-set':'Stock Not Set',
            'out-of-stock':'Out of Stock',
            'in-stock':'In Stock'
        }[state] || '';
    }

    function refreshCategoryOptions() {
        const selected = categoryFilter.value || 'all';
        categoryFilter.innerHTML = '<option value="all">All Categories</option>';
        ProductService.getCategories().forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categoryFilter.appendChild(option);
        });
        categoryFilter.value = Array.from(categoryFilter.options).some(option => option.value === selected) ? selected : 'all';
    }

    function refreshProductOptions() {
        const items = InventoryService.getItems();
        const previous = productSelect.value;
        productSelect.textContent = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.textContent = items.length ? 'Select product' : 'No products available';
        productSelect.appendChild(placeholder);

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.productId;
            option.textContent = item.name;
            productSelect.appendChild(option);
        });

        productSelect.disabled = items.length === 0;
        if (previous && items.some(item => String(item.productId) === String(previous))) {
            productSelect.value = previous;
        }
        return items;
    }

    function renderInventory() {
        refreshCategoryOptions();
        const allItems = InventoryService.getItems();
        const query = search.value.trim().toLowerCase();
        const category = categoryFilter.value;
        const status = statusFilter.value;

        const items = allItems.filter(item => {
            const state = inventoryState(item);
            return (!query || String(item.name || '').toLowerCase().includes(query)) &&
                (category === 'all' || item.category === category) &&
                (status === 'all' || state === status);
        });

        table.textContent = '';
        items.forEach(item => {
            const state = inventoryState(item);
            const row = document.createElement('tr');
            row.dataset.productId = item.productId;
            row.innerHTML = `<td><div class="staff-table-product"><img src="${escapeHtml(item.image || '')}" alt=""><strong>${escapeHtml(item.name)}</strong></div></td>
                <td>${escapeHtml(ProductService.getCategoryName(item.category))}</td>
                <td>${ProductService.formatPrice(item.price)}</td>
                <td><span class="status-badge ${state}">${stateLabel(state)}</span></td>
                <td><div class="stock-editor"><input class="staff-field stock-input" type="number" min="0" step="1" value="${Number.isInteger(item.stock) ? item.stock : ''}" placeholder="Not set" aria-label="Stock for ${escapeHtml(item.name)}"><button class="staff-small-button save-stock" type="button">Save</button></div></td>
                <td>${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '—'}</td>`;
            table.appendChild(row);
        });

        empty.textContent = items.length ? '' : (allItems.length ? 'No matching products.' : 'No products.');
        empty.hidden = items.length > 0;
        refreshProductOptions();
    }

    function renderBatches() {
        const batches = InventoryService.getBatches().slice(0, 10);
        batchList.textContent = '';

        batches.forEach(batch => {
            const row = document.createElement('article');
            row.className = 'batch-row';
            const notes = batch.notes ? `<small>${escapeHtml(batch.notes)}</small>` : '';
            row.innerHTML = `<div><strong>${escapeHtml(batch.productName)}</strong>${notes}</div>
                <div><strong>${Number(batch.quantity || 0)} pcs</strong><small>Quantity</small></div>
                <div><strong>${escapeHtml(batch.bakedDate)}</strong><small>Baked</small></div>
                <div><strong>${escapeHtml(batch.expirationDate)}</strong><small>Expires</small></div>`;
            batchList.appendChild(row);
        });

        batchEmpty.textContent = batches.length ? '' : 'No batches.';
        batchEmpty.hidden = batches.length > 0;
    }

    table.addEventListener('click', async function (event) {
        const button = event.target.closest('.save-stock');
        if (!button) return;

        const row = button.closest('tr');
        const input = row.querySelector('.stock-input');

        if (input.value === '') {
            setMessage(message, 'Enter a stock quantity.', 'error');
            return;
        }

        const result = await Promise.resolve(InventoryService.updateStock(row.dataset.productId, input.value));
        setMessage(message, result.ok ? 'Stock updated.' : result.message, result.ok ? 'success' : 'error');
        renderInventory();
    });

    [search, categoryFilter, statusFilter].forEach(control => {
        control.addEventListener(control === search ? 'input' : 'change', renderInventory);
    });

    function localDateValue() {
        const d = new Date();
        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, '0'),
            String(d.getDate()).padStart(2, '0')
        ].join('-');
    }

    function openDialog() {
        const items = refreshProductOptions();
        document.getElementById('batch-baked-date').value = localDateValue();
        setMessage(batchMessage, items.length ? '' : 'No products available.', items.length ? '' : 'error');
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    }

    function closeDialog() {
        setMessage(batchMessage, '');
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    document.getElementById('open-batch-dialog').addEventListener('click', openDialog);
    document.getElementById('close-batch-dialog').addEventListener('click', closeDialog);
    document.getElementById('cancel-batch').addEventListener('click', closeDialog);

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const data = new FormData(form);
        const result = await Promise.resolve(InventoryService.addBatch({
            productId: data.get('productId'),
            quantity: data.get('quantity'),
            bakedDate: data.get('bakedDate'),
            expirationDate: data.get('expirationDate'),
            notes: data.get('notes')
        }));

        if (!result.ok) {
            setMessage(batchMessage, result.message, 'error');
            return;
        }

        form.reset();
        closeDialog();
        setMessage(message, 'Batch saved.', 'success');
        renderInventory();
        renderBatches();
    });

    window.addEventListener('panadero-inventory-changed', function () {
        renderInventory();
        renderBatches();
    });

    renderInventory();
    renderBatches();
    if (new URLSearchParams(location.search).get('action') === 'batch') openDialog();
})();
