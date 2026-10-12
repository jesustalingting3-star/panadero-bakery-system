(function () {
    const safeHtml = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const KEY = 'panadero-cart';
    const MAX = 99;
    let storageAvailable = true;

    // A cart entry is stored by its original product ID plus stable name/slug.
    // MySQL IDs are numeric, while the initial local catalog has slug IDs.
    // Never throw away stored entries before the API catalog has loaded.
    const identity = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

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
            if (!entry || typeof entry !== 'object') continue;
            const id = String(entry.productId ?? entry.id ?? '').trim();
            const quantity = Math.floor(Number(entry.quantity));
            if (!id || !Number.isFinite(quantity) || quantity < 1) continue;
            const previous = out.find(item => item.productId === id);
            if (previous) {
                previous.quantity = Math.min(MAX, previous.quantity + quantity);
            } else {
                out.push({
                    productId: id,
                    quantity: Math.min(MAX, quantity),
                    slug: String(entry.slug || ''),
                    name: String(entry.name || '')
                });
            }
        }
        return out;
    }

    function getCart() {
        try {
            const cart = normalize(JSON.parse(localStorage.getItem(KEY) || '[]'));
            storageAvailable = true;
            return cart;
        } catch (_) {
            storageAvailable = false;
            return [];
        }
    }

    function findProduct(entry) {
        if (!entry) return null;
        const direct = ProductService.getProductById(entry.productId);
        if (direct) return direct;
        const bySlug = ProductService.getProductBySlug(entry.slug || entry.productId);
        if (bySlug) return bySlug;
        const wanted = identity(entry.name || entry.slug || entry.productId);
        return ProductService.getProducts().find(product =>
            identity(product.name) === wanted || identity(product.slug) === wanted
        ) || null;
    }

    function sameProduct(item, product) {
        if (!product) return false;
        if (item.productId === String(product.id)) return true;
        const resolved = findProduct(item);
        if (resolved) return identity(resolved.name) === identity(product.name);
        return Boolean((item.name && identity(item.name) === identity(product.name)) ||
            (item.slug && identity(item.slug) === identity(product.slug)));
    }

    function save(cart) {
        const clean = normalize(cart);
        try {
            localStorage.setItem(KEY, JSON.stringify(clean));
            storageAvailable = true;
        } catch (_) {
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
        const cart = getCart();
        const found = cart.find(item => sameProduct(item, product));
        if (found) {
            found.quantity = Math.min(stockMax, found.quantity + requested);
            found.productId = String(product.id);
            found.slug = product.slug;
            found.name = product.name;
        } else {
            cart.push({ productId: String(product.id), quantity: Math.min(stockMax, requested),
                slug: product.slug, name: product.name });
        }
        save(cart);
        return true;
    }

    function updateQuantity(id, quantity) {
        const cart = getCart();
        const found = cart.find(item => item.productId === String(id));
        if (!found) return false;
        const product = findProduct(found);
        if (!product || maxForProduct(product) === 0) return false;
        let q = Math.floor(Number(quantity));
        if (!Number.isFinite(q) || q < 1) q = 1;
        found.quantity = Math.min(maxForProduct(product), q);
        found.productId = String(product.id);
        found.slug = product.slug;
        found.name = product.name;
        save(cart);
        return true;
    }

    function removeItem(id) {
        save(getCart().filter(item => item.productId !== String(id)));
    }

    function clearCart() {
        save([]);
    }

    function getCartCount() {
        return getCart().reduce((sum, item) => sum + item.quantity, 0);
    }

    function detailed() {
        return getCart().map(item => {
            const product = findProduct(item);
            if (!product) return null; // Keep the entry stored until the live catalog loads.
            const max = maxForProduct(product);
            return Object.assign({}, item, {
                product,
                quantity: max > 0 ? Math.min(item.quantity, max) : item.quantity,
                lineTotal: product.price * (max > 0 ? Math.min(item.quantity, max) : item.quantity),
                maxQuantity: max
            });
        }).filter(Boolean);
    }

    function getSubtotal() {
        return detailed().reduce((sum, item) => sum + item.lineTotal, 0);
    }

    function notify() {
        updateCounts();
        window.dispatchEvent(new CustomEvent('panadero:cart-changed'));
    }

    function updateCounts() {
        const count = getCartCount();
        document.querySelectorAll('.cart-count').forEach(el => { el.textContent = count; });
    }

    window.CartService = {
        getCart,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        getCartCount,
        getDetailedCart: detailed,
        getSubtotal,
        formatPrice: ProductService.formatPrice,
        storageKey: KEY,
        isStorageAvailable: () => storageAvailable
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
            row.innerHTML = `<img src="${safeHtml(entry.product.image)}" alt="${safeHtml(entry.product.name)}"><div><h3><a href="product.html?slug=${encodeURIComponent(entry.product.slug)}">${safeHtml(entry.product.name)}</a></h3><p>${ProductService.formatPrice(entry.product.price)} each</p><label class="visually-hidden" for="drawer-${entry.product.id}">Quantity for ${safeHtml(entry.product.name)}</label><input id="drawer-${entry.product.id}" type="number" min="1" max="${max}" value="${entry.quantity}"><button class="remove-link" type="button">Remove</button></div><strong>${ProductService.formatPrice(entry.lineTotal)}</strong>`;
            row.querySelector('input').addEventListener('change', function (event) {
                updateQuantity(entry.productId, event.target.value);
                renderDrawer();
            });
            row.querySelector('.remove-link').addEventListener('click', async function () {
                const confirmed = window.PanaderoConfirm
                    ? await PanaderoConfirm({
                        title: 'Remove item?',
                        message: `${entry.product.name} will be removed from your cart.`,
                        confirmText: 'Remove',
                        danger: true
                    })
                    : window.confirm(`Remove ${entry.product.name} from your cart?`);

                if (!confirmed) return;
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
        ProductService.refreshProducts().then(notify).catch(() => {});
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
    ProductService.refreshProducts().then(notify).catch(() => {});
    if (document.readyState !== 'loading') updateCounts();
})();
