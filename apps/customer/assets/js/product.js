(async function () {
    const shell = document.getElementById('product-view');
    if (!shell) return;

    await ProductService.refreshProducts();
    const slug = new URLSearchParams(location.search).get('slug');
    const product = ProductService.getProductBySlug(slug);

    if (!product) {
        shell.innerHTML = `
            <section class="not-found">
                <h1>Product Not Found</h1>
                <p class="muted">The product you requested is unavailable or the link is incorrect.</p>
                <a href="menu.html" class="button" style="margin-top:20px">Back to Menu</a>
            </section>
        `;
        return;
    }

    document.title = `PANADERO | ${product.name}`;
    const categoryName = ProductService.getCategoryName(product.category);

    shell.innerHTML = `
        <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="index.html">Home</a><span>/</span>
            <a href="menu.html">Menu</a><span>/</span>
            <a href="menu.html?category=${encodeURIComponent(product.category)}">${categoryName}</a><span>/</span>
            <span aria-current="page">${product.name}</span>
        </nav>

        <section class="product-detail">
            <div class="product-image-wrap">
                <img src="${product.image}" alt="${product.name}">
            </div>

            <div class="product-info">
                <p class="product-category">${categoryName}</p>
                <h1>${product.name}</h1>
                <p class="price">${ProductService.formatPrice(product.price)}</p>

                <div class="stock-panel" aria-live="polite">
                    <div class="stock-row">
                        <span>Availability</span>
                        <strong id="product-availability"></strong>
                    </div>
                    <div class="stock-row">
                        <span>Stock</span>
                        <strong id="product-stock"></strong>
                    </div>
                </div>

                <section class="purchase-panel" aria-label="Purchase options">
                    <div class="quantity-block">
                        <h2>Quantity</h2>
                        <div class="quantity-stepper">
                            <button type="button" id="decrease-quantity" class="quantity-button" aria-label="Decrease quantity">−</button>
                            <input id="product-quantity" type="number" min="1" max="99" step="1" value="1" inputmode="numeric" aria-label="Product quantity">
                            <button type="button" id="increase-quantity" class="quantity-button" aria-label="Increase quantity">+</button>
                        </div>
                    </div>

                    <div class="product-total" aria-live="polite">
                        <span>Total</span>
                        <strong id="product-total">${ProductService.formatPrice(product.price)}</strong>
                    </div>

                    <div class="product-actions">
                        <button type="button" class="product-action add-cart-button" id="add-product-to-cart">Add to Cart</button>
                        <button type="button" class="product-action order-button" id="order-product">Place Order</button>
                        <button type="button" class="product-action reservation-button" id="reserve-product">Reserve for Later</button>
                    </div>

                    <p id="product-message" class="status-message" role="status" aria-live="polite"></p>
                </section>
            </div>
        </section>
    `;

    const availabilityEl = document.getElementById('product-availability');
    const stockEl = document.getElementById('product-stock');
    const quantityInput = document.getElementById('product-quantity');
    const decreaseButton = document.getElementById('decrease-quantity');
    const increaseButton = document.getElementById('increase-quantity');
    const totalEl = document.getElementById('product-total');
    const addToCartButton = document.getElementById('add-product-to-cart');
    const orderButton = document.getElementById('order-product');
    const reserveButton = document.getElementById('reserve-product');
    const message = document.getElementById('product-message');

    const hasStockNumber = Number.isInteger(product.stock) && product.stock >= 0;
    const isPublished = product.available !== false;
    const isAvailable = isPublished && (!hasStockNumber || product.stock > 0);
    const maxQuantity = hasStockNumber ? Math.max(1, Math.min(99, product.stock)) : 99;

    if (!isPublished || (hasStockNumber && product.stock === 0)) {
        availabilityEl.textContent = 'Out of Stock';
        availabilityEl.className = 'stock-status out-of-stock';
    } else if (hasStockNumber) {
        availabilityEl.textContent = 'In Stock';
        availabilityEl.className = 'stock-status in-stock';
    } else {
        availabilityEl.textContent = 'Pending inventory update';
        availabilityEl.className = 'stock-pending';
    }

    if (hasStockNumber) {
        stockEl.textContent = `${product.stock} available`;
    } else {
        stockEl.textContent = 'Stock count pending';
        stockEl.className = 'stock-pending';
    }

    quantityInput.max = String(maxQuantity);

    function normalizeQuantity(value) {
        let quantity = Math.floor(Number(value));
        if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
        return Math.min(maxQuantity, quantity);
    }

    function updatePurchaseState(value) {
        const quantity = normalizeQuantity(value);
        quantityInput.value = String(quantity);
        totalEl.textContent = ProductService.formatPrice(product.price * quantity);
        increaseButton.disabled = !isAvailable || quantity >= maxQuantity;
        decreaseButton.disabled = !isAvailable || quantity <= 1;
        quantityInput.disabled = !isAvailable;
        addToCartButton.disabled = !isAvailable;
        orderButton.disabled = !isAvailable;
        reserveButton.disabled = !isAvailable;
        return quantity;
    }

    function getQuantity() {
        return updatePurchaseState(quantityInput.value);
    }

    decreaseButton.addEventListener('click', function () {
        updatePurchaseState(getQuantity() - 1);
    });

    increaseButton.addEventListener('click', function () {
        updatePurchaseState(getQuantity() + 1);
    });

    quantityInput.addEventListener('input', function () {
        if (this.value !== '') updatePurchaseState(this.value);
    });
    quantityInput.addEventListener('change', getQuantity);
    quantityInput.addEventListener('blur', getQuantity);

    addToCartButton.addEventListener('click', function () {
        if (!isAvailable) return;
        const quantity = getQuantity();
        const added = CartService.addItem(product.id, quantity);

        if (!added) {
            message.className = 'status-message error';
            message.textContent = 'This product could not be added to your cart.';
            return;
        }

        message.className = 'status-message success';
        message.textContent = `${product.name} × ${quantity} added to cart.`;

        const originalText = addToCartButton.textContent;
        addToCartButton.textContent = 'Added to Cart ✓';
        window.setTimeout(function () {
            addToCartButton.textContent = originalText;
        }, 1200);
    });

    function openDirectFlow(page, statusText) {
        if (!isAvailable) return;
        const quantity = getQuantity();
        const targetUrl = new URL(page, location.href);
        targetUrl.searchParams.set('product', product.id);
        targetUrl.searchParams.set('quantity', String(quantity));

        orderButton.disabled = true;
        reserveButton.disabled = true;
        message.className = 'status-message info';
        message.textContent = statusText;
        location.assign(targetUrl.href);
    }

    orderButton.addEventListener('click', function () {
        openDirectFlow('checkout.html', 'Opening order checkout…');
    });

    reserveButton.addEventListener('click', function () {
        openDirectFlow('reservation.html', 'Opening reservation details…');
    });

    updatePurchaseState(1);

    if (!isAvailable) {
        message.className = 'status-message error';
        message.textContent = 'This product is currently out of stock.';
    }
})();
