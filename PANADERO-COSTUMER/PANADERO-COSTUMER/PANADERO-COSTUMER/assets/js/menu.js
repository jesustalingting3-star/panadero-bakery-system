(async function () {
    const grid = document.getElementById('product-grid');
    const search = document.getElementById('menu-search');
    const status = document.getElementById('menu-status');
    const buttons = [...document.querySelectorAll('.category-button')];
    if (!grid) return;

    const loaded = await ProductService.refreshProducts();
    if (!loaded && status) status.textContent = 'Unable to load the menu. Please refresh or try again later.';

    let category = 'bread';
    const params = new URLSearchParams(location.search);
    const initial = params.get('category');

    if (ProductService.isValidCategory(initial)) {
        category = initial;
    }

    function setActive() {
        buttons.forEach(function (button) {
            const active = button.dataset.category === category;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    function render() {
        const query = (search?.value || '').trim();
        const products = query
            ? ProductService.searchProducts(query)
            : ProductService.getProductsByCategory(category);

        grid.textContent = '';

        if (!products.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state no-results';
            empty.textContent = 'No items found.';
            grid.appendChild(empty);
        } else {
            products.forEach(function (product) {
                const card = document.createElement('a');
                card.className = 'product-card';
                card.href = 'product.html?slug=' + encodeURIComponent(product.slug);
                card.setAttribute('aria-label', 'View ' + product.name);
                const stockLabel = Number.isInteger(product.stock)
                    ? `<span class="product-stock-label ${product.stock === 0 ? 'out' : ''}">${product.stock === 0 ? 'Out of Stock' : product.stock + ' in stock'}</span>`
                    : '';
                card.innerHTML = `
                    <img src="${product.image}" alt="${product.name}">
                    <div class="product-card-body">
                        <h3>${product.name}</h3>
                        <p class="price">${ProductService.formatPrice(product.price)}</p>
                        ${stockLabel}
                        <span class="product-order-link">View &amp; Order</span>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        if (status) {
            const baseText = query
                ? `Search results for “${query}”`
                : `Showing ${ProductService.getCategoryName(category)}`;
            status.textContent = baseText;
        }

        setActive();
    }

    buttons.forEach(function (button) {
        button.addEventListener('click', function () {
            category = button.dataset.category;
            if (search) search.value = '';

            const url = new URL(location.href);
            url.searchParams.set('category', category);
            history.replaceState({}, '', url);
            render();
        });
    });

    if (search) {
        search.addEventListener('input', render);
    }

    render();
})();
