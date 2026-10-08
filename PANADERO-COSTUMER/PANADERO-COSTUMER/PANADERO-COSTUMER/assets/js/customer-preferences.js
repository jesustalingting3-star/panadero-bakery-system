(function () {
    const STORAGE_KEY = 'panadero-customer-preferences-v1';

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
        } catch (error) {
            return {};
        }
    }

    function writeAll(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            return false;
        }
    }

    function getPreferences() {
        const key = userKey();
        if (!key) return {};
        const all = readAll();
        const saved = all[key];
        return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    }

    function updatePreferences(changes) {
        const key = userKey();
        if (!key) return false;
        const all = readAll();
        const existing = all[key] && typeof all[key] === 'object' && !Array.isArray(all[key]) ? all[key] : {};
        all[key] = Object.assign({}, existing, changes, { updatedAt: new Date().toISOString() });
        return writeAll(all);
    }

    function cleanContact(contact) {
        contact = contact && typeof contact === 'object' ? contact : {};
        return {
            firstName: String(contact.firstName || '').trim(),
            lastName: String(contact.lastName || '').trim(),
            email: String(contact.email || '').trim(),
            mobile: String(contact.mobile || '').trim()
        };
    }

    function getContactDefaults() {
        const user = currentUser() || {};
        const saved = cleanContact(getPreferences().contact);
        return {
            firstName: String(user.firstName || saved.firstName || '').trim(),
            lastName: String(user.lastName || saved.lastName || '').trim(),
            email: String(user.email || saved.email || '').trim(),
            mobile: String(saved.mobile || user.mobile || '').trim()
        };
    }

    function rememberContact(contact) {
        const cleaned = cleanContact(contact);
        const current = getPreferences();
        return updatePreferences({
            contact: Object.assign({}, current.contact || {}, cleaned)
        });
    }

    function getCheckoutDefaults() {
        const saved = getPreferences();
        return {
            contact: getContactDefaults(),
            deliveryMethod: saved.deliveryMethod === 'delivery' ? 'delivery' : 'pickup'
        };
    }

    function saveCheckoutPreferences(order) {
        order = order && typeof order === 'object' ? order : {};
        const fulfillment = order.fulfillment && typeof order.fulfillment === 'object' ? order.fulfillment : {};
        const method = fulfillment.method === 'delivery' ? 'delivery' : 'pickup';
        const changes = {
            deliveryMethod: method
        };
        updatePreferences(changes);
        rememberContact(order.customer);
    }

    function saveReservationPreferences(reservation) {
        reservation = reservation && typeof reservation === 'object' ? reservation : {};
        rememberContact(reservation.customer);
    }

    window.CustomerPreferenceService = {
        getContactDefaults: getContactDefaults,
        getCheckoutDefaults: getCheckoutDefaults,
        saveCheckoutPreferences: saveCheckoutPreferences,
        saveReservationPreferences: saveReservationPreferences
    };
})();
