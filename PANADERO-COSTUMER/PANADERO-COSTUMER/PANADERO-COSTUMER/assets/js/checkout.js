(async function () {
    const empty = document.getElementById('checkout-empty');
    const layout = document.getElementById('checkout-layout');
    const itemsEl = document.getElementById('checkout-summary-items');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const form = document.getElementById('checkout-form');
    const message = document.getElementById('checkout-message');
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const deliveryArea = document.getElementById('delivery-address-area');
    const savedAddressSection = document.getElementById('saved-address-section');
    const savedAddressSelect = document.getElementById('saved-address-select');
    const savedAddressPreview = document.getElementById('saved-address-preview');
    const addAddressButton = document.getElementById('add-address-button');
    const manageAddressesButton = document.getElementById('manage-addresses-button');
    const addressDialog = document.getElementById('address-dialog');
    const addressDialogContent = document.getElementById('address-dialog-content');

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
    const savedDefaults = window.CustomerPreferenceService
        ? CustomerPreferenceService.getCheckoutDefaults()
        : null;
    const contactDefaults = savedDefaults && savedDefaults.contact
        ? savedDefaults.contact
        : (currentUser || {});

    if (form.elements.firstName) form.elements.firstName.value = contactDefaults.firstName || '';
    if (form.elements.lastName) form.elements.lastName.value = contactDefaults.lastName || '';
    if (form.elements.email) form.elements.email.value = contactDefaults.email || '';
    if (form.elements.mobile) form.elements.mobile.value = contactDefaults.mobile || '';

    if (savedDefaults && form.elements.deliveryMethod) {
        const preferredMethod = savedDefaults.deliveryMethod === 'delivery' ? 'delivery' : 'pickup';
        const preferredRadio = form.querySelector(`[name="deliveryMethod"][value="${preferredMethod}"]`);
        if (preferredRadio) preferredRadio.checked = true;
    }

    let selectedAddressId = '';

    function currentAddresses() {
        return currentUser && window.AddressService ? AddressService.getAddresses() : [];
    }

    function addressLabel(address) {
        return address.label + (address.isDefault ? ' (Default)' : '');
    }

    function refreshSavedAddressOptions(preferId) {
        if (!savedAddressSelect || !savedAddressSection) return;
        const addresses = currentAddresses();
        savedAddressSection.hidden = !currentUser;
        savedAddressSelect.textContent = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = addresses.length ? 'Choose a saved address' : 'No saved addresses';
        placeholder.disabled = addresses.length === 0;
        savedAddressSelect.appendChild(placeholder);

        addresses.forEach(function (address) {
            const option = document.createElement('option');
            option.value = address.id;
            option.textContent = addressLabel(address);
            savedAddressSelect.appendChild(option);
        });

        const defaultAddress = window.AddressService ? AddressService.getDefault() : null;
        const desired = preferId && addresses.some(function (address) { return address.id === preferId; })
            ? preferId
            : (defaultAddress ? defaultAddress.id : '');
        selectedAddressId = desired || '';
        savedAddressSelect.value = selectedAddressId;
        applySelectedAddress();
    }

    function applySelectedAddress() {
        if (!savedAddressSelect || !savedAddressPreview) return;
        selectedAddressId = savedAddressSelect.value || '';
        const address = selectedAddressId && window.AddressService ? AddressService.getById(selectedAddressId) : null;
        if (address) {
            const formatted = AddressService.formatAddress(address);
            savedAddressPreview.textContent = address.recipientName + ' • ' + address.mobile + '\n' + formatted;
            savedAddressPreview.style.whiteSpace = 'pre-line';
            savedAddressPreview.hidden = false;
            if (form.elements.mobile && !form.elements.mobile.value) form.elements.mobile.value = address.mobile || '';
        } else {
            savedAddressPreview.hidden = true;
            savedAddressPreview.textContent = '';
        }
    }

    function dialogClose() {
        if (!addressDialog) return;
        if (typeof addressDialog.close === 'function') addressDialog.close();
        else addressDialog.removeAttribute('open');
    }

    function dialogOpen() {
        if (!addressDialog) return;
        if (typeof addressDialog.showModal === 'function') addressDialog.showModal();
        else addressDialog.setAttribute('open', '');
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char];
        });
    }

    async function addressForm(address) {
        address = address || {};
        const userName = currentUser ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') : '';
        const defaultMobile = (currentUser && currentUser.mobile) || (form.elements.mobile && form.elements.mobile.value) || '';
        addressDialogContent.innerHTML = `
            <div class="address-dialog-header">
                <h2 id="address-dialog-title">${address.id ? 'Edit Address' : 'Add Address'}</h2>
                <button class="address-dialog-close" type="button" data-address-action="close" aria-label="Close">×</button>
            </div>
            <div class="address-dialog-body">
                <form id="saved-address-form" novalidate>
                    <div class="address-form-grid">
                        <div class="address-form-group"><label for="address-label">Address Label</label><input class="field" id="address-label" name="label" minlength="2" maxlength="30" value="${escapeHtml(address.label || '')}" placeholder="Home" required></div>
                        <div class="address-form-group"><label for="address-recipient">Recipient Name</label><input class="field" id="address-recipient" name="recipientName" minlength="2" maxlength="80" value="${escapeHtml(address.recipientName || userName)}" required></div>
                        <div class="address-form-group"><label for="address-mobile">Mobile Number</label><input class="field" id="address-mobile" name="mobile" type="tel" inputmode="numeric" pattern="09[0-9]{9}" maxlength="11" value="${escapeHtml(address.mobile || defaultMobile)}" placeholder="09XXXXXXXXX" required></div>
                        <div class="address-form-group"><label for="address-postal">Postal Code</label><input class="field" id="address-postal" name="postalCode" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${escapeHtml(address.postalCode || '')}" placeholder="4000" required></div>
                        <div class="address-form-group full"><label for="address-house">House/Unit &amp; Street</label><input class="field" id="address-house" name="houseStreet" minlength="3" maxlength="120" value="${escapeHtml(address.houseStreet || '')}" required></div>
                        <div class="address-form-group"><label for="address-country">Country</label><input class="field" id="address-country" value="Philippines" readonly aria-readonly="true"></div>
                        <div class="address-form-group ph-dropdown-location"><label for="address-region">Region</label><select class="field" id="address-region" required><option value="">Loading...</option></select></div>
                        <div class="address-form-group ph-dropdown-location"><label for="address-province">Province</label><select class="field" id="address-province" disabled><option value="">Select region first</option></select></div>
                        <div class="address-form-group ph-dropdown-location"><label for="address-city">City/Municipality</label><select class="field" id="address-city" required disabled><option value="">Select province first</option></select></div>
                        <div class="address-form-group ph-dropdown-location"><label for="address-barangay">Barangay</label><select class="field" id="address-barangay" required disabled><option value="">Select city/municipality first</option></select></div>
                        <div class="address-form-group ph-manual-location" hidden><label for="address-manual-region">Region</label><input class="field" id="address-manual-region" maxlength="80" value="${escapeHtml(address.region || '')}" disabled></div>
                        <div class="address-form-group ph-manual-location" hidden><label for="address-manual-province">Province</label><input class="field" id="address-manual-province" maxlength="80" value="${escapeHtml(address.province || '')}" disabled></div>
                        <div class="address-form-group ph-manual-location" hidden><label for="address-manual-city">City/Municipality</label><input class="field" id="address-manual-city" maxlength="80" value="${escapeHtml(address.city || '')}" disabled></div>
                        <div class="address-form-group ph-manual-location" hidden><label for="address-manual-barangay">Barangay</label><input class="field" id="address-manual-barangay" maxlength="80" value="${escapeHtml(address.barangay || '')}" disabled></div>
                        <p class="address-location-status full" id="ph-location-status" role="status"></p>
                        <div class="address-form-group full"><label for="address-landmark">Landmark (Optional)</label><input class="field" id="address-landmark" name="landmark" maxlength="120" value="${escapeHtml(address.landmark || '')}"></div>
                        <div class="address-form-group full"><label class="choice" style="padding:10px 12px"><input type="checkbox" name="isDefault" ${address.isDefault ? 'checked' : ''}><span><strong>Set as default address</strong></span></label></div>
                    </div>
                    <p class="address-dialog-message" id="saved-address-message" role="status"></p>
                    <div class="address-dialog-actions">
                        <button class="button secondary" type="button" data-address-action="back">Cancel</button>
                        <button class="button" type="submit">Save Address</button>
                    </div>
                </form>
            </div>`;

        const addressFormEl = document.getElementById('saved-address-form');
        const labelEl = document.getElementById('address-label');
        const recipientEl = document.getElementById('address-recipient');
        const mobileEl = document.getElementById('address-mobile');
        const postalEl = document.getElementById('address-postal');
        const regionEl = document.getElementById('address-region');
        const provinceEl = document.getElementById('address-province');
        const cityEl = document.getElementById('address-city');
        const barangayEl = document.getElementById('address-barangay');
        const locationStatus = document.getElementById('ph-location-status');
        const dropdownGroups = Array.from(addressFormEl.querySelectorAll('.ph-dropdown-location'));
        const manualGroups = Array.from(addressFormEl.querySelectorAll('.ph-manual-location'));
        const manualRegion = document.getElementById('address-manual-region');
        const manualProvince = document.getElementById('address-manual-province');
        const manualCity = document.getElementById('address-manual-city');
        const manualBarangay = document.getElementById('address-manual-barangay');
        let manualMode = false;

        function cleanPersonInput(input) {
            if (!input) return;
            input.value = input.value.replace(/[^A-Za-zÑñÀ-ÖØ-öø-ÿ.' -]/g, '').slice(0, Number(input.maxLength) || 80);
        }
        function cleanLocationInput(input) {
            if (!input) return;
            input.value = input.value.replace(/[^A-Za-z0-9ÑñÀ-ÖØ-öø-ÿ.'() -]/g, '').slice(0, Number(input.maxLength) || 80);
        }
        if (labelEl) labelEl.addEventListener('input', function () { labelEl.value = labelEl.value.replace(/[^A-Za-z0-9ÑñÀ-ÖØ-öø-ÿ.' &()/-]/g, '').slice(0, 30); });
        if (recipientEl) recipientEl.addEventListener('input', function () { cleanPersonInput(recipientEl); });
        if (mobileEl) mobileEl.addEventListener('input', function () { mobileEl.value = mobileEl.value.replace(/\D/g, '').slice(0, 11); });
        if (postalEl) postalEl.addEventListener('input', function () { postalEl.value = postalEl.value.replace(/\D/g, '').slice(0, 4); });
        [manualRegion, manualProvince, manualCity, manualBarangay].forEach(function (input) {
            if (input) input.addEventListener('input', function () { cleanLocationInput(input); });
        });

        function setManualMode(messageText) {
            manualMode = true;
            dropdownGroups.forEach(function (group) { group.hidden = true; });
            [regionEl, provinceEl, cityEl, barangayEl].forEach(function (select) { if (select) select.disabled = true; });
            manualGroups.forEach(function (group) { group.hidden = false; });
            [manualRegion, manualCity, manualBarangay].forEach(function (input) { if (input) { input.disabled = false; input.required = true; } });
            if (manualProvince) { manualProvince.disabled = false; manualProvince.required = false; }
            if (locationStatus) {
                locationStatus.className = 'address-location-status error full';
                locationStatus.textContent = messageText || 'Enter the Philippine location manually.';
            }
        }

        function selectedText(select) {
            if (!select || !select.value || !select.options[select.selectedIndex]) return '';
            return select.options[select.selectedIndex].textContent.trim();
        }

        function fillSelect(select, items, placeholder, preferredCode, preferredName) {
            select.textContent = '';
            const first = document.createElement('option');
            first.value = '';
            first.textContent = placeholder;
            select.appendChild(first);
            items.forEach(function (item) {
                const option = document.createElement('option');
                option.value = String(item.code || '');
                option.textContent = String(item.name || '');
                select.appendChild(option);
            });
            const code = String(preferredCode || '');
            const name = String(preferredName || '').toLowerCase();
            let match = null;
            if (code) match = items.find(function (item) { return String(item.code) === code; });
            if (!match && name) match = items.find(function (item) { return String(item.name || '').toLowerCase() === name; });
            if (match) select.value = String(match.code || '');
            return match;
        }

        function resetSelect(select, text) {
            select.innerHTML = `<option value="">${escapeHtml(text)}</option>`;
            select.disabled = true;
        }

        async function loadBarangays(preferredCode, preferredName) {
            if (!cityEl.value) return resetSelect(barangayEl, 'Select city/municipality first');
            resetSelect(barangayEl, 'Loading barangays...');
            const barangays = await PHAddressService.getBarangays(cityEl.value);
            barangayEl.disabled = false;
            fillSelect(barangayEl, barangays, 'Select barangay', preferredCode, preferredName);
        }

        async function loadCities(preferredCode, preferredName, barangayCode, barangayName) {
            resetSelect(cityEl, 'Loading cities/municipalities...');
            resetSelect(barangayEl, 'Select city/municipality first');
            const cities = provinceEl.value
                ? await PHAddressService.getCitiesMunicipalitiesByProvince(provinceEl.value)
                : await PHAddressService.getCitiesMunicipalitiesByRegion(regionEl.value);
            cityEl.disabled = false;
            const selected = fillSelect(cityEl, cities, 'Select city/municipality', preferredCode, preferredName);
            if (selected) await loadBarangays(barangayCode, barangayName);
        }

        async function loadProvinces(preferredProvinceCode, preferredProvinceName, cityCode, cityName, barangayCode, barangayName) {
            resetSelect(provinceEl, 'Loading provinces...');
            resetSelect(cityEl, 'Select province first');
            resetSelect(barangayEl, 'Select city/municipality first');
            const provinces = await PHAddressService.getProvinces(regionEl.value);
            if (!provinces.length) {
                provinceEl.innerHTML = '<option value="">Not applicable</option>';
                provinceEl.disabled = true;
                await loadCities(cityCode, cityName, barangayCode, barangayName);
                return;
            }
            provinceEl.disabled = false;
            const selected = fillSelect(provinceEl, provinces, 'Select province', preferredProvinceCode, preferredProvinceName);
            if (selected) await loadCities(cityCode, cityName, barangayCode, barangayName);
        }

        async function initializePhilippineLocations() {
            if (!window.PHAddressService) return setManualMode('Enter the Philippine location manually.');
            if (address.id && !address.region && !address.regionCode) return setManualMode('Enter the location for this saved address.');
            try {
                if (locationStatus) {
                    locationStatus.className = 'address-location-status full';
                    locationStatus.textContent = 'Loading Philippine locations...';
                }
                const regions = await PHAddressService.getRegions();
                regionEl.disabled = false;
                const selectedRegion = fillSelect(regionEl, regions, 'Select region', address.regionCode, address.region);
                if (selectedRegion) {
                    await loadProvinces(address.provinceCode, address.province, address.cityCode, address.city, address.barangayCode, address.barangay);
                }
                if (locationStatus) locationStatus.textContent = '';
            } catch (_) {
                setManualMode('Location list unavailable. Enter the Philippine location manually.');
            }
        }

        regionEl.addEventListener('change', async function () {
            if (!regionEl.value) {
                resetSelect(provinceEl, 'Select region first');
                resetSelect(cityEl, 'Select province first');
                resetSelect(barangayEl, 'Select city/municipality first');
                return;
            }
            try {
                await loadProvinces('', '', '', '', '', '');
            } catch (_) {
                setManualMode('Location list unavailable. Enter the Philippine location manually.');
            }
        });
        provinceEl.addEventListener('change', async function () {
            if (!provinceEl.value) {
                resetSelect(cityEl, 'Select province first');
                resetSelect(barangayEl, 'Select city/municipality first');
                return;
            }
            try { await loadCities('', '', '', ''); }
            catch (_) { setManualMode('Location list unavailable. Enter the Philippine location manually.'); }
        });
        cityEl.addEventListener('change', async function () {
            if (!cityEl.value) return resetSelect(barangayEl, 'Select city/municipality first');
            try { await loadBarangays('', ''); }
            catch (_) { setManualMode('Location list unavailable. Enter the Philippine location manually.'); }
        });

        addressFormEl.addEventListener('submit', function (event) {
            event.preventDefault();
            if (!addressFormEl.reportValidity()) return;
            const fd = new FormData(addressFormEl);
            const payload = {
                label: fd.get('label'),
                recipientName: fd.get('recipientName'),
                mobile: fd.get('mobile'),
                houseStreet: fd.get('houseStreet'),
                country: 'Philippines',
                region: manualMode ? manualRegion.value : selectedText(regionEl),
                regionCode: manualMode ? '' : regionEl.value,
                province: manualMode ? manualProvince.value : selectedText(provinceEl),
                provinceCode: manualMode ? '' : provinceEl.value,
                city: manualMode ? manualCity.value : selectedText(cityEl),
                cityCode: manualMode ? '' : cityEl.value,
                barangay: manualMode ? manualBarangay.value : selectedText(barangayEl),
                barangayCode: manualMode ? '' : barangayEl.value,
                postalCode: fd.get('postalCode'),
                landmark: fd.get('landmark'),
                isDefault: fd.get('isDefault') === 'on'
            };
            const result = address.id ? AddressService.updateAddress(address.id, payload) : AddressService.addAddress(payload);
            const msg = document.getElementById('saved-address-message');
            if (!result.ok) {
                msg.className = 'address-dialog-message error';
                msg.textContent = result.message || 'Unable to save the address.';
                return;
            }
            refreshSavedAddressOptions(result.address.id);
            dialogClose();
        });

        await initializePhilippineLocations();
    }

    function addressManager() {
        const addresses = currentAddresses();
        addressDialogContent.innerHTML = `
            <div class="address-dialog-header">
                <h2 id="address-dialog-title">Saved Addresses</h2>
                <button class="address-dialog-close" type="button" data-address-action="close" aria-label="Close">×</button>
            </div>
            <div class="address-dialog-body">
                ${addresses.length ? `<div class="address-list">${addresses.map(function (address) {
                    return `<article class="address-card" data-address-id="${escapeHtml(address.id)}">
                        <div class="address-card-head"><div><div class="address-card-title"><strong>${escapeHtml(address.label)}</strong>${address.isDefault ? '<span class="address-default-badge">Default</span>' : ''}</div><p>${escapeHtml(address.recipientName)} • ${escapeHtml(address.mobile)}</p></div></div>
                        <p>${escapeHtml(AddressService.formatAddress(address))}</p>
                        <div class="address-card-actions">
                            <button class="address-mini-button" type="button" data-address-action="use">Use</button>
                            <button class="address-mini-button" type="button" data-address-action="edit">Edit</button>
                            ${address.isDefault ? '' : '<button class="address-mini-button" type="button" data-address-action="default">Set Default</button>'}
                            <button class="address-mini-button danger" type="button" data-address-action="delete">Delete</button>
                        </div>
                    </article>`;
                }).join('')}</div>` : '<p class="address-empty">No saved addresses.</p>'}
                <div class="address-dialog-actions"><button class="button" type="button" data-address-action="add">+ Add Address</button></div>
            </div>`;
    }

    function deleteConfirm(address) {
        addressDialogContent.innerHTML = `
            <div class="address-dialog-header"><h2 id="address-dialog-title">Delete Address</h2><button class="address-dialog-close" type="button" data-address-action="close" aria-label="Close">×</button></div>
            <div class="address-dialog-body">
                <p>Delete <strong>${escapeHtml(address.label)}</strong>?</p>
                <div class="address-dialog-actions">
                    <button class="button secondary" type="button" data-address-action="manage">Cancel</button>
                    <button class="button" type="button" data-address-action="confirm-delete" data-address-id="${escapeHtml(address.id)}">Delete</button>
                </div>
            </div>`;
    }

    if (savedAddressSelect) savedAddressSelect.addEventListener('change', applySelectedAddress);
    if (addAddressButton) addAddressButton.addEventListener('click', function () { addressForm(null); dialogOpen(); });
    if (manageAddressesButton) manageAddressesButton.addEventListener('click', function () { addressManager(); dialogOpen(); });
    if (addressDialog) {
        addressDialog.addEventListener('click', function (event) {
            if (event.target === addressDialog) return dialogClose();
            const actionButton = event.target.closest('[data-address-action]');
            if (!actionButton) return;
            const action = actionButton.dataset.addressAction;
            if (action === 'close') return dialogClose();
            if (action === 'back' || action === 'manage') { addressManager(); return; }
            if (action === 'add') { addressForm(null); return; }
            const card = actionButton.closest('[data-address-id]');
            const id = actionButton.dataset.addressId || (card && card.dataset.addressId) || '';
            const address = id ? AddressService.getById(id) : null;
            if (action === 'use' && address) {
                refreshSavedAddressOptions(address.id);
                dialogClose();
            } else if (action === 'edit' && address) {
                addressForm(address);
            } else if (action === 'default' && address) {
                AddressService.setDefault(address.id);
                refreshSavedAddressOptions(address.id);
                addressManager();
            } else if (action === 'delete' && address) {
                deleteConfirm(address);
            } else if (action === 'confirm-delete' && address) {
                AddressService.deleteAddress(address.id);
                refreshSavedAddressOptions('');
                addressManager();
            }
        });
    }

    function deliveryFields() {
        const method = form.elements.deliveryMethod.value;
        if (!deliveryArea) return;
        deliveryArea.hidden = method !== 'delivery';
        if (savedAddressSection) savedAddressSection.hidden = method !== 'delivery' || !currentUser;
    }

    form.querySelectorAll('[name="deliveryMethod"]').forEach(function (radio) {
        radio.addEventListener('change', deliveryFields);
    });

    if (currentUser && window.AddressService) refreshSavedAddressOptions('');
    deliveryFields();

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        message.textContent = '';
        message.className = 'status-message';

        if (!form.reportValidity()) return;

        if (submitButton) submitButton.disabled = true;

        const fd = new FormData(form);
        const deliveryMethod = fd.get('deliveryMethod');
        const paymentMethod = String(fd.get('paymentMethod') || 'cash');
        const selectedAddress = deliveryMethod === 'delivery' && selectedAddressId && window.AddressService
            ? AddressService.getById(selectedAddressId)
            : null;

        if (deliveryMethod === 'delivery' && !selectedAddress) {
            message.className = 'status-message error';
            message.textContent = 'Select or add a delivery address.';
            if (submitButton) submitButton.disabled = false;
            return;
        }

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
                addressId: selectedAddress ? selectedAddress.id : '',
                deliveryAddress: selectedAddress ? AddressService.formatAddress(selectedAddress) : '',
                recipientName: selectedAddress ? selectedAddress.recipientName : '',
                recipientMobile: selectedAddress ? selectedAddress.mobile : ''
            },
            paymentMethod: paymentMethod
        };

        try {
            const result = await OrderService.createOrder(order);

            if (!result || !result.ok) {
                message.className = 'status-message info';
                message.textContent = result?.message || 'Unable to place the order.';
                if (submitButton) submitButton.disabled = false;
                return;
            }

            const reference = result.order?.orderNumber || result.order?.order_number || result.order?.reference || '';

            if (window.CustomerPreferenceService) {
                CustomerPreferenceService.saveCheckoutPreferences(order);
            }

            if (!directCheckout) CartService.clearCart();

            const statusUrl = new URL('track-order.html', window.location.href);
            statusUrl.searchParams.set('tab', 'orders');
            if (reference) statusUrl.searchParams.set('ref', reference);
            window.location.assign(statusUrl.href);
        } catch (error) {
            message.className = 'status-message error';
            message.textContent = 'Unable to place the order. Please try again.';
            if (submitButton) submitButton.disabled = false;
        }
    });
})();
