(function () {
    const KEY = 'panadero-cart';
    const MAX = 99;
    let storageAvailable = true;

    function maxForProduct(product) {
        if (product && Number.isInteger(product.stock) && product.stock >= 0) {
            return Math.min(MAX, Math.max(0, product.stock));
        }
        return MAX;
    }

    function normalize(raw) {
        if (!Array.isArray(raw)) return [];
        const out = [];

        for (const entry of raw) {
            const id = entry && String(entry.productId || entry.id || '');
            const product = ProductService.getProductById(id);
            let q = Math.floor(Number(entry && entry.quantity));

            if (!product || !Number.isFinite(q) || q < 1 || out.some(function (x) { return x.productId === id; })) {
                continue;
            }

            const stockMax = maxForProduct(product);
            if (stockMax > 0) q = Math.min(q, stockMax);
            else q = Math.min(q, MAX);

            out.push({ productId: id, quantity: q });
        }

        return out;
    }

    function getCart() {
        try {
            return normalize(JSON.parse(localStorage.getItem(KEY) || '[]'));
        } catch (error) {
            storageAvailable = false;
            return [];
        }
    }

    function save(cart) {
        const clean = normalize(cart);
        try {
            localStorage.setItem(KEY, JSON.stringify(clean));
            storageAvailable = true;
        } catch (error) {
            storageAvailable = false;
        }
        notify();
        return clean;
    }

    function addItem(id, quantity) {
        const product = ProductService.getProductById(id);
        if (!product || product.available === false) return false;

        const stockMax = maxForProduct(product);
        if (stockMax === 0) return false;

        const requested = Math.max(1, Math.floor(Number(quantity) || 1));
        const q = Math.min(stockMax, requested);
        const cart = getCart();
        const found = cart.find(function (i) { return i.productId === String(id); });

        if (found) found.quantity = Math.min(stockMax, found.quantity + q);
        else cart.push({ productId: String(id), quantity: q });

        save(cart);
        return true;
    }

    function updateQuantity(id, quantity) {
        const product = ProductService.getProductById(id);
        if (!product) return false;

        const stockMax = maxForProduct(product);
        if (stockMax === 0) return false;

        const cart = getCart();
        const found = cart.find(function (i) { return i.productId === String(id); });
        if (!found) return false;

        let q = Math.floor(Number(quantity));
        if (!Number.isFinite(q) || q < 1) q = 1;
        found.quantity = Math.min(stockMax, q);
        save(cart);
        return true;
    }

    function removeItem(id) {
        save(getCart().filter(function (i) { return i.productId !== String(id); }));
    }

    function clearCart() {
        save([]);
    }

    function getCartCount() {
        return getCart().reduce(function (sum, item) { return sum + item.quantity; }, 0);
    }

    function detailed() {
        return getCart().map(function (item) {
            const product = ProductService.getProductById(item.productId);
            return product ? Object.assign({}, item, {
                product: product,
                lineTotal: product.price * item.quantity,
                maxQuantity: maxForProduct(product)
            }) : null;
        }).filter(Boolean);
    }

    function getSubtotal() {
        return detailed().reduce(function (sum, item) { return sum + item.lineTotal; }, 0);
    }

    function notify() {
        updateCounts();
        window.dispatchEvent(new CustomEvent('panadero:cart-changed'));
    }

    function updateCounts() {
        const count = getCartCount();
        document.querySelectorAll('.cart-count').forEach(function (el) { el.textContent = count; });
    }

    window.CartService = {
        getCart: getCart,
        addItem: addItem,
        updateQuantity: updateQuantity,
        removeItem: removeItem,
        clearCart: clearCart,
        getCartCount: getCartCount,
        getDetailedCart: detailed,
        getSubtotal: getSubtotal,
        formatPrice: ProductService.formatPrice,
        storageKey: KEY,
        isStorageAvailable: function () { return storageAvailable; }
    };

    function buildDrawer() {
        if (document.getElementById('cart-drawer')) return;
        const d = document.createElement('dialog');
        d.id = 'cart-drawer';
        d.className = 'cart-drawer';
        d.setAttribute('aria-labelledby', 'cart-title');
        d.innerHTML = `<button type="button" class="close-cart" aria-label="Close cart">×</button><div class="cart-heading"><h2 id="cart-title">My Cart</h2><a href="menu.html" class="button">+ Add Items</a></div><p class="cart-note cart-storage" hidden>Cart saving is unavailable. Items may reset when you leave.</p><div class="drawer-items"></div><p class="drawer-empty">Your cart is empty.</p><div class="cart-subtotal"><span>Subtotal</span><strong class="drawer-total">₱0.00</strong></div><a href="cart.html" class="button secondary" style="width:100%;margin-top:18px">View Cart</a><a href="checkout.html" class="button drawer-checkout">Proceed to Checkout</a>`;
        document.body.appendChild(d);
        d.querySelector('.close-cart').addEventListener('click', function () { d.close(); });
        d.addEventListener('close', function () { document.body.classList.remove('cart-open'); });
        d.addEventListener('click', function (event) {
            const b = d.getBoundingClientRect();
            const outside = event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom;
            if (event.target === d && outside) d.close();
        });
    }

    function renderDrawer() {
        const d = document.getElementById('cart-drawer');
        if (!d) return;
        const items = d.querySelector('.drawer-items');
        items.textContent = '';
        const cart = detailed();

        for (const entry of cart) {
            const row = document.createElement('div');
            row.className = 'drawer-item';
            const max = entry.maxQuantity > 0 ? entry.maxQuantity : MAX;
            row.innerHTML = `<img src="${entry.product.image}" alt="${entry.product.name}"><div><h3><a href="product.html?slug=${encodeURIComponent(entry.product.slug)}">${entry.product.name}</a></h3><p>${ProductService.formatPrice(entry.product.price)} each</p><label class="visually-hidden" for="drawer-${entry.product.id}">Quantity for ${entry.product.name}</label><input id="drawer-${entry.product.id}" type="number" min="1" max="${max}" value="${entry.quantity}"><button class="remove-link" type="button">Remove</button></div><strong>${ProductService.formatPrice(entry.lineTotal)}</strong>`;
            row.querySelector('input').addEventListener('change', function (event) {
                updateQuantity(entry.productId, event.target.value);
                renderDrawer();
            });
            row.querySelector('.remove-link').addEventListener('click', function () {
                removeItem(entry.productId);
                renderDrawer();
            });
            items.appendChild(row);
        }

        d.querySelector('.drawer-empty').hidden = cart.length > 0;
        d.querySelector('.drawer-total').textContent = ProductService.formatPrice(getSubtotal());
        d.querySelector('.drawer-checkout').classList.toggle('disabled', cart.length === 0);
        d.querySelector('.drawer-checkout').setAttribute('aria-disabled', String(cart.length === 0));
        d.querySelector('.drawer-checkout').onclick = cart.length === 0 ? function (event) { event.preventDefault(); } : null;
        d.querySelector('.cart-storage').hidden = storageAvailable;
        updateCounts();
    }

    function openDrawer() {
        buildDrawer();
        renderDrawer();
        const d = document.getElementById('cart-drawer');
        if (!d.open) d.showModal();
        document.body.classList.add('cart-open');
    }

    document.addEventListener('click', function (event) {
        const btn = event.target.closest('.open-cart');
        if (btn) {
            event.preventDefault();
            openDrawer();
        }
    });

    window.addEventListener('storage', function (event) {
        if (event.key === KEY || event.key === null) notify();
    });
    window.addEventListener('panadero:cart-changed', function () {
        updateCounts();
        if (document.getElementById('cart-drawer')?.open) renderDrawer();
    });
    document.addEventListener('DOMContentLoaded', updateCounts);
    if (document.readyState !== 'loading') updateCounts();
})();
