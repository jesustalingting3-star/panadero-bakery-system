(function () {
    const login = document.getElementById("login-form");
    const register = document.getElementById("register-form");
    const loginMessage = document.getElementById("login-message");
    const registerMessage = document.getElementById("register-message");

    if (login) {
        login.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (!login.reportValidity()) {
                return;
            }

            loginMessage.className = "auth-message info";
            loginMessage.textContent = "Signing in...";

            const result = await AuthService.login(
                login.email.value.trim(),
                login.password.value
            );

            if (result.ok && result.user) {
                loginMessage.className = "auth-message success";
                loginMessage.textContent = "Logged in as " + result.user.displayName + ".";

                window.setTimeout(function () {
                    window.location.replace("index.html");
                }, 450);
                return;
            }

            loginMessage.className = "auth-message error";
            loginMessage.textContent = result.message || "Unable to log in.";
        });
    }

    if (register) {
        const password = document.getElementById("reg-password");
        const confirmation = document.getElementById("confirm-password");

        function checkPasswords() {
            const mismatch = confirmation.value && password.value !== confirmation.value;
            confirmation.setCustomValidity(mismatch ? "Passwords do not match." : "");

            if (!mismatch) {
                registerMessage.textContent = "";
            }
        }

        password.addEventListener("input", checkPasswords);
        confirmation.addEventListener("input", checkPasswords);

        register.addEventListener("submit", async function (event) {
            event.preventDefault();
            checkPasswords();

            if (!register.reportValidity()) {
                if (password.value !== confirmation.value) {
                    registerMessage.textContent = "Passwords do not match.";
                }
                registerMessage.className = "auth-message error";
                return;
            }

            const result = await AuthService.register({
                firstName: register.first_name.value.trim(),
                lastName: register.last_name.value.trim(),
                email: register.email.value.trim(),
                mobile: register.mobile.value.trim(),
                password: password.value
            });

            if (result.ok && result.user) {
                registerMessage.className = "auth-message success";
                registerMessage.textContent = "Account created. Logged in as " + result.user.displayName + ".";
                return;
            }

            registerMessage.className = result.ok ? "auth-message success" : "auth-message info";
            registerMessage.textContent = result.message || "Unable to create the account.";
        });
    }
})();
