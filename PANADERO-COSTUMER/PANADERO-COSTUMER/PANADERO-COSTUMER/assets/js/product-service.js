(function () {
    const data = window.PANADERO_DATA || { products: [], categories: [], fallbackImage: '' };
    const categorySlug = value => { const slug = String(value || '').toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return ({ breads: 'bread', cakes: 'cake', doughnuts: 'doughnut', pies: 'pie' }[slug] || slug); };
    const byId = id => data.products.find(product => String(product.id) === String(id)) || null;
    const bySlug = slug => data.products.find(product => product.slug === String(slug)) || null;
    const getProducts = () => data.products.filter(product => product.available !== false).map(product => ({ ...product }));
    const getCategoryName = id => (data.categories.find(category => String(category.id) === String(id)) || { name: id || '' }).name;
    const getCategories = () => data.categories.map(category => ({ ...category }));
    window.ProductService = {
        async refreshProducts() {
            try {
                const response = await fetch((window.PANADERO_API || '/api') + '/catalog');
                if (!response.ok) return false;
                const result = await response.json();
                data.products = result.products || [];
                data.categories = (result.categories || []).map(category => ({ ...category, id: categorySlug(category.name) }));
                window.PANADERO_DATA = data;
                return true;
            } catch (_) { return false; }
        },
        getProducts,
        getProductById: id => byId(id) ? { ...byId(id) } : null,
        getProductBySlug: slug => bySlug(slug) ? { ...bySlug(slug) } : null,
        getProductsByCategory: category => getProducts().filter(product => String(product.category) === String(category)),
        searchProducts: query => {
            const q = String(query || '').trim().toLowerCase();
            return getProducts().filter(product => !q || product.name.toLowerCase().includes(q) || String(product.category).toLowerCase().includes(q) || getCategoryName(product.category).toLowerCase().includes(q));
        },
        getCategories,
        getCategoryName,
        isValidCategory: id => data.categories.some(category => String(category.id) === String(id)),
        formatPrice: value => '₱' + Number(value || 0).toFixed(2),
        fallbackImage: data.fallbackImage
    };
})();
