(async function () {
    const list = document.getElementById('cart-page-items');
    const empty = document.getElementById('cart-page-empty');
    const layout = document.getElementById('cart-layout');
    const subtotalEl = document.getElementById('cart-page-subtotal');
    const checkout = document.getElementById('cart-checkout-link');
    if (!list || !empty || !layout || !subtotalEl || !checkout) return;

    await ProductService.refreshProducts();

    function render() {
        const cart = CartService.getDetailedCart();
        list.textContent = '';
        empty.hidden = cart.length > 0;
        layout.hidden = cart.length === 0;

        for (const entry of cart) {
            const max = entry.maxQuantity > 0 ? entry.maxQuantity : 99;
            const row = document.createElement('article');
            row.className = 'cart-page-item';
            row.innerHTML = `<img src="${entry.product.image}" alt="${entry.product.name}"><div><h2><a href="product.html?slug=${encodeURIComponent(entry.product.slug)}">${entry.product.name}</a></h2><p class="unit-price">${ProductService.formatPrice(entry.product.price)} each</p><div class="quantity-controls"><button type="button" class="dec" aria-label="Decrease ${entry.product.name} quantity">−</button><label class="visually-hidden" for="cart-${entry.product.id}">Quantity</label><input id="cart-${entry.product.id}" type="number" min="1" max="${max}" value="${entry.quantity}"><button type="button" class="inc" aria-label="Increase ${entry.product.name} quantity">+</button></div><button type="button" class="remove-cart-item">Remove</button></div><strong class="cart-item-total">${ProductService.formatPrice(entry.lineTotal)}</strong>`;

            const input = row.querySelector('input');
            row.querySelector('.dec').addEventListener('click', function () {
                CartService.updateQuantity(entry.productId, Math.max(1, entry.quantity - 1));
                render();
            });
            row.querySelector('.inc').addEventListener('click', function () {
                CartService.updateQuantity(entry.productId, Math.min(max, entry.quantity + 1));
                render();
            });
            input.addEventListener('change', function () {
                CartService.updateQuantity(entry.productId, input.value);
                render();
            });
            row.querySelector('.remove-cart-item').addEventListener('click', function () {
                CartService.removeItem(entry.productId);
                render();
            });
            list.appendChild(row);
        }

        subtotalEl.textContent = ProductService.formatPrice(CartService.getSubtotal());
        checkout.setAttribute('aria-disabled', String(cart.length === 0));
    }

    window.addEventListener('panadero:cart-changed', render);
    render();
})();
