(function () {
    const SESSION_KEY = 'panadero-auth-session-v2';
    let provider = null;

    function notify(user) {
        window.dispatchEvent(new CustomEvent('panadero-auth-changed', { detail: user || null }));
    }

    function normalizeUser(user) {
        if (!user || typeof user !== 'object') return null;

        const firstName = String(user.firstName || '').trim();
        const lastName = String(user.lastName || '').trim();
        const displayName = String(
            user.displayName ||
            [firstName, lastName].filter(Boolean).join(' ') ||
            user.email ||
            'Customer'
        ).trim();

        return {
            id: user.id != null ? String(user.id) : '',
            firstName: firstName,
            lastName: lastName,
            displayName: displayName,
            email: String(user.email || '').trim(),
            mobile: String(user.mobile || '').trim(),
            role: String(user.role || 'customer'),
            avatarUrl: String(user.avatarUrl || '').trim()
        };
    }

    function readSession() {
        try {
            const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
            const user = normalizeUser(saved);
            return user && user.role === 'customer' ? user : null;
        } catch (error) {
            return null;
        }
    }

    function saveSession(user) {
        const normalized = normalizeUser(user);
        if (!normalized) return null;
        localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
        notify(normalized);
        return normalized;
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
        notify(null);
    }

    async function callProvider(method, args, saveUser) {
        if (!provider || typeof provider[method] !== 'function') {
            return {
                ok: false,
                code: 'NOT_AVAILABLE',
                message: 'This account action is not connected yet.'
            };
        }

        try {
            const result = await provider[method].apply(provider, args || []);
            if (result && result.ok && saveUser && result.user) {
                result.user = saveSession(result.user);
            }
            return result || { ok: false, message: 'Unable to complete this action.' };
        } catch (error) {
            return { ok: false, message: 'Unable to complete this action right now.' };
        }
    }

    window.AuthService = {
        // A future backend can provide the real authentication implementation here.
        setProvider(nextProvider) {
            provider = nextProvider && typeof nextProvider === 'object' ? nextProvider : null;
        },

        getCurrentUser() {
            return readSession();
        },

        setCurrentUser(user) {
            return saveSession(user);
        },

        clearCurrentUser() {
            clearSession();
        },

        async login(email, password) {
            return callProvider('login', [email, password], true);
        },

        async register(payload) {
            return callProvider('register', [payload], true);
        },

        async logout() {
            if (provider && typeof provider.logout === 'function') {
                try { await provider.logout(); } catch (error) {}
            }
            clearSession();
            return { ok: true };
        },

        async requestPasswordReset(email) {
            return callProvider('requestPasswordReset', [email], false);
        }
    };
})();
