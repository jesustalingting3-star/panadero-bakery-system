(function () {
    const form = document.getElementById('reset-form');
    const message = document.getElementById('reset-message');
    if (!form || !message) return;

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;

        message.className = 'status-message info';
        message.textContent = 'Submitting request…';

        const result = await AuthService.requestPasswordReset(form.email.value.trim());
        message.className = result.ok ? 'status-message success' : 'status-message info';
        message.textContent = result.message || (result.ok
            ? 'Password reset request submitted.'
            : 'Password reset is not available yet.');
    });
})();
