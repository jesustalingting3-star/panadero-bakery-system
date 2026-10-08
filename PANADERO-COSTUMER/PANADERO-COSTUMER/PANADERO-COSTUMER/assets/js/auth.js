(function () {
    const login = document.getElementById("login-form");
    const register = document.getElementById("register-form");
    const loginMessage = document.getElementById("login-message");
    const registerMessage = document.getElementById("register-message");

    function redirectForRole(user) {
        const role = String(user && user.role || "customer").trim().toLowerCase();
        if (role === "admin") {
            window.location.href = "/admin/admin.html";
        } else if (role === "staff") {
            window.location.href = "/staff/staff-dashboard.html";
        } else {
            window.location.href = "index.html";
        }
    }

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
                    redirectForRole(result.user);
                }, 450);
                return;
            }

            loginMessage.className = "auth-message error";
            loginMessage.textContent = result.message || "Unable to log in.";
        });
    }

    if (register) {
        const firstName = register.first_name;
        const lastName = register.last_name;
        const email = register.email;
        const mobile = register.mobile;
        const password = document.getElementById("reg-password");
        const confirmation = document.getElementById("confirm-password");
        const namePattern = /^[A-Za-zÑñÀ-ÖØ-öø-ÿ]+(?:[ '\-][A-Za-zÑñÀ-ÖØ-öø-ÿ]+)*$/;
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const mobilePattern = /^09\d{9}$/;

        function cleanNameInput(input) {
            input.value = input.value.replace(/[^A-Za-zÑñÀ-ÖØ-öø-ÿ' \-]/g, "");
        }

        function validateName(input, label) {
            const value = input.value.trim();
            let message = "";

            if (value && value.length < 2) {
                message = label + " must be at least 2 letters.";
            } else if (value && !namePattern.test(value)) {
                message = label + " can only contain letters, spaces, hyphens, and apostrophes.";
            }

            input.setCustomValidity(message);
            return message;
        }

        function validateEmail() {
            const value = email.value.trim();
            const message = value && !emailPattern.test(value)
                ? "Enter a valid email address."
                : "";
            email.setCustomValidity(message);
            return message;
        }

        function validateMobile() {
            const value = mobile.value.trim();
            const message = value && !mobilePattern.test(value)
                ? "Enter an 11-digit Philippine mobile number starting with 09."
                : "";
            mobile.setCustomValidity(message);
            return message;
        }

        function checkPasswords() {
            let message = "";

            if (password.value && password.value.length < 8) {
                message = "Password must be at least 8 characters.";
                password.setCustomValidity(message);
            } else {
                password.setCustomValidity("");
            }

            const mismatch = confirmation.value && password.value !== confirmation.value;
            confirmation.setCustomValidity(mismatch ? "Passwords do not match." : "");

            return mismatch ? "Passwords do not match." : message;
        }

        firstName.addEventListener("input", function () {
            cleanNameInput(firstName);
            validateName(firstName, "First name");
            registerMessage.textContent = "";
        });

        lastName.addEventListener("input", function () {
            cleanNameInput(lastName);
            validateName(lastName, "Last name");
            registerMessage.textContent = "";
        });

        email.addEventListener("input", function () {
            validateEmail();
            registerMessage.textContent = "";
        });

        mobile.addEventListener("input", function () {
            mobile.value = mobile.value.replace(/\D/g, "").slice(0, 11);
            validateMobile();
            registerMessage.textContent = "";
        });

        password.addEventListener("input", function () {
            checkPasswords();
            registerMessage.textContent = "";
        });

        confirmation.addEventListener("input", function () {
            checkPasswords();
            registerMessage.textContent = "";
        });

        register.addEventListener("submit", async function (event) {
            event.preventDefault();

            const firstNameError = validateName(firstName, "First name");
            const lastNameError = validateName(lastName, "Last name");
            const emailError = validateEmail();
            const mobileError = validateMobile();
            const passwordError = checkPasswords();

            if (!register.reportValidity()) {
                registerMessage.className = "auth-message error";
                registerMessage.textContent = firstNameError || lastNameError || emailError || mobileError || passwordError || "Please check the highlighted fields.";
                return;
            }

            const result = await AuthService.register({
                firstName: firstName.value.trim(),
                lastName: lastName.value.trim(),
                email: email.value.trim(),
                mobile: mobile.value.trim(),
                password: password.value
            });

            if (result.ok) {
                AuthService.clearCurrentUser();
                registerMessage.className = "auth-message success";
                registerMessage.textContent = "Sign up successful. Redirecting to login...";

                window.setTimeout(function () {
                    window.location.href = "login.html";
                }, 450);
                return;
            }

            registerMessage.className = "auth-message error";
            registerMessage.textContent = result.message || "Unable to sign up.";
        });
    }
})();
