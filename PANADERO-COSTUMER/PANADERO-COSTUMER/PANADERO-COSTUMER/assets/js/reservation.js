(async function () {
    const empty = document.getElementById('reservation-empty');
    const layout = document.getElementById('reservation-layout');
    const itemsEl = document.getElementById('reservation-summary-items');
    const subtotalEl = document.getElementById('reservation-subtotal');
    const form = document.getElementById('reservation-form');
    const message = document.getElementById('reservation-message');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;

    if (!empty || !layout || !itemsEl || !subtotalEl || !form || !message) return;

    await ProductService.refreshProducts();

    const params = new URLSearchParams(location.search);
    const productId = params.get('product');
    const requestedQuantity = params.get('quantity');
    const product = productId ? ProductService.getProductById(productId) : null;

    if (!product || product.available === false || (Number.isInteger(product.stock) && product.stock === 0)) {
        empty.hidden = false;
        layout.hidden = true;
        return;
    }

    function normalizeQuantity(value) {
        let quantity = Math.floor(Number(value));
        if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
        const max = Number.isInteger(product.stock) && product.stock >= 0 ? Math.min(99, product.stock) : 99;
        return max > 0 ? Math.min(max, quantity) : quantity;
    }

    const quantity = normalizeQuantity(requestedQuantity);
    const lineTotal = product.price * quantity;

    layout.hidden = false;
    empty.hidden = true;

    const row = document.createElement('div');
    row.className = 'summary-item';
    row.innerHTML = `<span>${product.name} × ${quantity}</span><strong>${ProductService.formatPrice(lineTotal)}</strong>`;
    itemsEl.appendChild(row);
    subtotalEl.textContent = ProductService.formatPrice(lineTotal);

    const currentUser = window.AuthService ? AuthService.getCurrentUser() : null;
    const contactDefaults = window.CustomerPreferenceService
        ? CustomerPreferenceService.getContactDefaults()
        : (currentUser || {});

    if (form.elements.firstName) form.elements.firstName.value = contactDefaults.firstName || '';
    if (form.elements.lastName) form.elements.lastName.value = contactDefaults.lastName || '';
    if (form.elements.email) form.elements.email.value = contactDefaults.email || '';
    if (form.elements.mobile) form.elements.mobile.value = contactDefaults.mobile || '';

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

        const reservation = {
            customer: {
                firstName: String(fd.get('firstName') || '').trim(),
                lastName: String(fd.get('lastName') || '').trim(),
                email: String(fd.get('email') || '').trim(),
                mobile: String(fd.get('mobile') || '').trim()
            },
            items: [{
                productId: product.id,
                quantity: quantity
            }],
            schedule: {
                preferredDate: String(fd.get('date') || ''),
                preferredTime: String(fd.get('time') || '')
            }
        };

        try {
            const result = await ReservationService.createReservation(reservation);

            if (!result || !result.ok) {
                message.className = 'status-message info';
                message.textContent = result?.message || 'Unable to submit the reservation.';
                if (submitButton) submitButton.disabled = false;
                return;
            }

            const reference = result.reservation?.reservationNumber || result.reservation?.reservation_number || result.reservation?.reference || '';

            if (window.CustomerPreferenceService) {
                CustomerPreferenceService.saveReservationPreferences(reservation);
            }

            const statusUrl = new URL('track-order.html', window.location.href);
            statusUrl.searchParams.set('tab', 'reservations');
            if (reference) statusUrl.searchParams.set('ref', reference);
            window.location.assign(statusUrl.href);
        } catch (error) {
            message.className = 'status-message error';
            message.textContent = 'Unable to submit the reservation. Please try again.';
            if (submitButton) submitButton.disabled = false;
        }
    });
})();
