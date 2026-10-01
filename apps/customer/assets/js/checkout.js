(async function () {
    const empty = document.getElementById('checkout-empty');
    const layout = document.getElementById('checkout-layout');
    const itemsEl = document.getElementById('checkout-summary-items');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const form = document.getElementById('checkout-form');
    const message = document.getElementById('checkout-message');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;

    if (!empty || !layout || !itemsEl || !subtotalEl || !form || !message) return;

    await ProductService.refreshProducts();

    const params = new URLSearchParams(location.search);
    const requestedProductId = params.get('product');
    const requestedQuantity = params.get('quantity');

    function stockMax(product) {
        return Number.isInteger(product.stock) && product.stock >= 0 ? Math.min(99, product.stock) : 99;
    }

    function normalizeQuantity(value, product) {
        let quantity = Math.floor(Number(value));
        if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
        const max = stockMax(product);
        return max > 0 ? Math.min(max, quantity) : quantity;
    }

    function getCheckoutItems() {
        if (requestedProductId) {
            const product = ProductService.getProductById(requestedProductId);
            if (!product || product.available === false || stockMax(product) === 0) return null;

            const quantity = normalizeQuantity(requestedQuantity, product);
            return [{
                productId: product.id,
                quantity: quantity,
                product: product,
                lineTotal: product.price * quantity
            }];
        }

        return CartService.getDetailedCart();
    }

    const checkoutItems = getCheckoutItems();
    const directCheckout = Boolean(requestedProductId);

    if (checkoutItems === null) {
        empty.hidden = false;
        layout.hidden = true;
        empty.innerHTML = `<h2>Product unavailable.</h2><p>The selected product is unavailable or out of stock. Please choose it again from the menu.</p><a href="menu.html" class="button" style="margin-top:18px">Browse Menu</a>`;
        return;
    }

    if (!checkoutItems.length) {
        empty.hidden = false;
        layout.hidden = true;
        return;
    }

    layout.hidden = false;
    empty.hidden = true;

    function getSubtotal() {
        return checkoutItems.reduce(function (sum, entry) { return sum + entry.lineTotal; }, 0);
    }

    itemsEl.textContent = '';
    checkoutItems.forEach(function (entry) {
        const row = document.createElement('div');
        row.className = 'summary-item';
        row.innerHTML = `<span>${entry.product.name} × ${entry.quantity}</span><strong>${ProductService.formatPrice(entry.lineTotal)}</strong>`;
        itemsEl.appendChild(row);
    });
    subtotalEl.textContent = ProductService.formatPrice(getSubtotal());

    const currentUser = window.AuthService ? AuthService.getCurrentUser() : null;
    if (currentUser) {
        if (form.elements.firstName) form.elements.firstName.value = currentUser.firstName || '';
        if (form.elements.lastName) form.elements.lastName.value = currentUser.lastName || '';
        if (form.elements.email) form.elements.email.value = currentUser.email || '';
        if (form.elements.mobile) form.elements.mobile.value = currentUser.mobile || '';
    }

    function deliveryFields() {
        const method = form.elements.deliveryMethod.value;
        const wrap = document.getElementById('delivery-address-wrap');
        const address = document.getElementById('delivery-address');
        if (!wrap || !address) return;
        wrap.hidden = method !== 'delivery';
        address.required = method === 'delivery';
        if (method !== 'delivery') address.value = '';
    }

    form.querySelectorAll('[name="deliveryMethod"]').forEach(function (radio) {
        radio.addEventListener('change', deliveryFields);
    });
    deliveryFields();

    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    if (dateInput) {
        const now = new Date();
        dateInput.min = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0')
        ].join('-');
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        message.textContent = '';
        message.className = 'status-message';

        if (!form.reportValidity()) return;

        if (dateInput && timeInput && dateInput.value && timeInput.value) {
            const requestedDateTime = new Date(`${dateInput.value}T${timeInput.value}`);
            if (!Number.isFinite(requestedDateTime.getTime()) || requestedDateTime <= new Date()) {
                message.className = 'status-message error';
                message.textContent = 'Please choose a future date and time.';
                return;
            }
        }

        if (submitButton) submitButton.disabled = true;

        const fd = new FormData(form);
        const deliveryMethod = fd.get('deliveryMethod');

        // The browser sends only product IDs + quantities as authoritative item input.
        const order = {
            customer: {
                firstName: String(fd.get('firstName') || '').trim(),
                lastName: String(fd.get('lastName') || '').trim(),
                email: String(fd.get('email') || '').trim(),
                mobile: String(fd.get('mobile') || '').trim()
            },
            items: checkoutItems.map(function (entry) {
                return {
                    productId: entry.product.id,
                    quantity: entry.quantity
                };
            }),
            fulfillment: {
                method: deliveryMethod,
                deliveryAddress: deliveryMethod === 'delivery'
                    ? String(fd.get('deliveryAddress') || '').trim()
                    : '',
                preferredDate: String(fd.get('date') || ''),
                preferredTime: String(fd.get('time') || '')
            }
        };

        try {
            const result = await OrderService.createOrder(order);

            if (!result || !result.ok) {
                message.className = 'status-message info';
                message.textContent = result?.message || 'Your order details are valid, but the order backend is not connected yet. No order was created.';
                if (submitButton) submitButton.disabled = false;
                return;
            }

            const reference = result.order?.orderNumber || result.order?.order_number || result.order?.reference || '';
            message.className = 'status-message success';
            message.textContent = reference
                ? `Order accepted. Reference: ${reference}`
                : (result.message || 'Order accepted.');

            if (!directCheckout) CartService.clearCart();
        } catch (error) {
            message.className = 'status-message error';
            message.textContent = 'The order could not be submitted. Please try again later.';
            if (submitButton) submitButton.disabled = false;
        }
    });
})();
