(function () {
    const STORAGE_KEY = 'panadero-saved-addresses-v1';
    const MAX_ADDRESSES = 10;

    function currentUser() {
        return window.AuthService ? AuthService.getCurrentUser() : null;
    }

    function userKey() {
        const user = currentUser();
        if (!user) return '';
        if (user.id) return 'id:' + String(user.id);
        if (user.email) return 'email:' + String(user.email).trim().toLowerCase();
        return '';
    }

    function readAll() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
        } catch (_) {
            return {};
        }
    }

    function writeAll(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (_) {
            return false;
        }
    }

    function clean(value) {
        return String(value == null ? '' : value).trim();
    }

    function normalize(payload) {
        payload = payload && typeof payload === 'object' ? payload : {};
        return {
            label: clean(payload.label),
            recipientName: clean(payload.recipientName),
            mobile: clean(payload.mobile).replace(/\D/g, '').slice(0, 11),
            houseStreet: clean(payload.houseStreet),
            country: 'Philippines',
            region: clean(payload.region),
            regionCode: clean(payload.regionCode),
            province: clean(payload.province),
            provinceCode: clean(payload.provinceCode),
            city: clean(payload.city),
            cityCode: clean(payload.cityCode),
            barangay: clean(payload.barangay),
            barangayCode: clean(payload.barangayCode),
            postalCode: clean(payload.postalCode).replace(/\D/g, '').slice(0, 4),
            landmark: clean(payload.landmark)
        };
    }

    function validate(address) {
        const namePattern = /^[A-Za-zÑñÀ-ÖØ-öø-ÿ.' -]{2,80}$/;
        if (!address.label || address.label.length > 30) return 'Enter an address label.';
        if (!namePattern.test(address.recipientName)) return 'Enter a valid recipient name.';
        if (!/^09\d{9}$/.test(address.mobile)) return 'Enter an 11-digit mobile number starting with 09.';
        if (!/^[A-Za-z0-9ÑñÀ-ÖØ-öø-ÿ.' &()/-]{2,30}$/.test(address.label)) return 'Enter a valid address label.';
        if (address.houseStreet.length < 3 || address.houseStreet.length > 120) return 'Enter a valid house/unit and street.';
        if (!address.region) return 'Select a region.';
        if (!address.city) return 'Select a city or municipality.';
        if (!address.barangay) return 'Select a barangay.';
        if (!/^\d{4}$/.test(address.postalCode)) return 'Enter a 4-digit postal code.';
        if (address.landmark.length > 120) return 'Landmark is too long.';
        return '';
    }

    function getAddresses() {
        const key = userKey();
        if (!key) return [];
        const all = readAll();
        const list = Array.isArray(all[key]) ? all[key] : [];
        return list.slice().sort(function (a, b) {
            if (Boolean(a.isDefault) !== Boolean(b.isDefault)) return a.isDefault ? -1 : 1;
            return String(a.label || '').localeCompare(String(b.label || ''));
        });
    }

    function saveList(list) {
        const key = userKey();
        if (!key) return false;
        const all = readAll();
        all[key] = list;
        return writeAll(all);
    }

    function getById(id) {
        return getAddresses().find(function (address) { return address.id === id; }) || null;
    }

    function getDefault() {
        const list = getAddresses();
        return list.find(function (address) { return address.isDefault; }) || list[0] || null;
    }

    function addAddress(payload) {
        if (!userKey()) return { ok: false, message: 'Please log in first.' };
        const address = normalize(payload);
        const error = validate(address);
        if (error) return { ok: false, message: error };
        const list = getAddresses();
        if (list.length >= MAX_ADDRESSES) return { ok: false, message: 'You can save up to 10 addresses.' };
        const id = 'address-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        const item = Object.assign({}, address, {
            id: id,
            isDefault: list.length === 0 || Boolean(payload && payload.isDefault),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        const next = list.map(function (a) { return item.isDefault ? Object.assign({}, a, { isDefault: false }) : a; });
        next.push(item);
        if (!saveList(next)) return { ok: false, message: 'Unable to save the address.' };
        return { ok: true, address: item };
    }

    function updateAddress(id, payload) {
        const list = getAddresses();
        const index = list.findIndex(function (address) { return address.id === id; });
        if (index < 0) return { ok: false, message: 'Address not found.' };
        const cleanAddress = normalize(payload);
        const error = validate(cleanAddress);
        if (error) return { ok: false, message: error };
        const makeDefault = Boolean(payload && payload.isDefault) || Boolean(list[index].isDefault);
        const updated = Object.assign({}, list[index], cleanAddress, { isDefault: makeDefault, updatedAt: new Date().toISOString() });
        const next = list.map(function (address, i) {
            if (i === index) return updated;
            return makeDefault ? Object.assign({}, address, { isDefault: false }) : address;
        });
        if (!saveList(next)) return { ok: false, message: 'Unable to update the address.' };
        return { ok: true, address: updated };
    }

    function deleteAddress(id) {
        const list = getAddresses();
        const removed = list.find(function (address) { return address.id === id; });
        if (!removed) return { ok: false, message: 'Address not found.' };
        let next = list.filter(function (address) { return address.id !== id; });
        if (removed.isDefault && next.length) {
            next = next.map(function (address, index) { return Object.assign({}, address, { isDefault: index === 0 }); });
        }
        if (!saveList(next)) return { ok: false, message: 'Unable to delete the address.' };
        return { ok: true };
    }

    function setDefault(id) {
        const list = getAddresses();
        if (!list.some(function (address) { return address.id === id; })) return { ok: false, message: 'Address not found.' };
        const next = list.map(function (address) { return Object.assign({}, address, { isDefault: address.id === id }); });
        if (!saveList(next)) return { ok: false, message: 'Unable to update the default address.' };
        return { ok: true, address: next.find(function (address) { return address.id === id; }) };
    }

    function formatAddress(address) {
        if (!address) return '';
        return [address.houseStreet, address.barangay, address.city, address.province, address.postalCode, address.country || 'Philippines']
            .map(clean)
            .filter(Boolean)
            .join(', ') + (address.landmark ? ' — ' + clean(address.landmark) : '');
    }

    window.AddressService = {
        getAddresses: getAddresses,
        getById: getById,
        getDefault: getDefault,
        addAddress: addAddress,
        updateAddress: updateAddress,
        deleteAddress: deleteAddress,
        setDefault: setDefault,
        formatAddress: formatAddress
    };
})();
