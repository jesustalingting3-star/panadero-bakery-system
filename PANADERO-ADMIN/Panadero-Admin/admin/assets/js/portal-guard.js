(function () {
    const SESSION = 'panadero-auth-session-v2';
    const TOKEN = 'panadero-api-token';
    const raw = localStorage.getItem(SESSION);
    let user = null;
    try { user = JSON.parse(raw || 'null'); } catch (_) {}
    const token = localStorage.getItem(TOKEN);
    if (!token || !user || String(user.role || '').toLowerCase() !== 'admin') {
        location.replace('/login.html');
        return;
    }
    // Logout is handled by the portal sidebar with a confirmation dialog.
})();
