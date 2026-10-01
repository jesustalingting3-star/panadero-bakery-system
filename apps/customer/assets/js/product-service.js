(function () {
    const data = window.PANADERO_DATA;

    function byId(id) {
        return data.products.find(function (product) {
            return product.id === String(id);
        }) || null;
    }

    function bySlug(slug) {
        return data.products.find(function (product) {
            return product.slug === String(slug);
        }) || null;
    }

    function categoryName(id) {
        const category = data.categories.find(function (item) {
            return item.id === id;
        });
        return category ? category.name : id;
    }

    window.ProductService = {
        // Frontend-only for now. Backend developers can replace the data source later.
        async refreshProducts() {
            return true;
        },

        getProducts() {
            return data.products
                .filter(function (product) { return product.available !== false; })
                .map(function (product) { return Object.assign({}, product); });
        },

        getProductById(id) {
            const product = byId(id);
            return product ? Object.assign({}, product) : null;
        },

        getProductBySlug(slug) {
            const product = bySlug(slug);
            return product ? Object.assign({}, product) : null;
        },

        getProductsByCategory(category) {
            return this.getProducts().filter(function (product) {
                return product.category === category;
            });
        },

        searchProducts(query) {
            const q = String(query || '').trim().toLowerCase();
            if (!q) return this.getProducts();

            return this.getProducts().filter(function (product) {
                return product.name.toLowerCase().includes(q) ||
                    product.category.toLowerCase().includes(q) ||
                    categoryName(product.category).toLowerCase().includes(q);
            });
        },

        getCategories() {
            return data.categories.map(function (category) {
                return Object.assign({}, category);
            });
        },

        getCategoryName: categoryName,

        isValidCategory(id) {
            return data.categories.some(function (category) {
                return category.id === id;
            });
        },

        formatPrice(value) {
            return '₱' + Number(value || 0).toFixed(2);
        },

        fallbackImage: data.fallbackImage
    };
})();
