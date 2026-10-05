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
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Logout';
    button.setAttribute('aria-label', 'Log out of PANADERO');
    button.style.cssText = 'position:fixed;top:16px;right:18px;z-index:9999;padding:10px 16px;border:0;border-radius:6px;background:#8d3f2f;color:#fff;font-weight:700;cursor:pointer;box-shadow:0 2px 8px #0002';
    button.addEventListener('click', async function () {
        button.disabled = true;
        try { await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }); } catch (_) {}
        localStorage.removeItem(SESSION);
        localStorage.removeItem(TOKEN);
        location.replace('/login.html');
    });
    document.body.appendChild(button);
})();
