/* PANADERO Staff frontend service placeholders.
   Real data will be supplied by the shared system later. */
(function () {
    const clone = value => JSON.parse(JSON.stringify(value));
    const products = Array.isArray(window.PANADERO_DATA && PANADERO_DATA.products) ? PANADERO_DATA.products : [];
    const categories = Array.isArray(window.PANADERO_DATA && PANADERO_DATA.categories) ? PANADERO_DATA.categories : [];

    window.ProductService = {
        getCategories: () => clone(categories),
        getCategoryName: id => (categories.find(category => category.id === id) || {name:id || ''}).name,
        formatPrice: value => value == null || value === '' ? '—' : '₱' + Number(value).toFixed(2)
    };

    window.InventoryService = {
        isConnected: () => false,
        getItems: () => clone(products),
        getBatches: () => [],
        updateStock() {
            return {ok:false, message:'Inventory update unavailable.'};
        },
        addBatch() {
            return {ok:false, message:'Batch saving unavailable.'};
        },
        getSummary() {
            const items = clone(products);
            const stocks = items.map(item => item.stock).filter(Number.isInteger);
            return {
                totalStock: stocks.reduce((total, stock) => total + stock, 0),
                outOfStock: items.filter(item => item.stock === 0).length,
                notSet: items.filter(item => !Number.isInteger(item.stock)).length
            };
        }
    };

    window.OrderService = {
        isConnected: () => false,
        async getAllOrders() { return []; },
        async updateStatus() {
            return {ok:false, message:'Order status update unavailable.'};
        }
    };

    window.ReservationService = {
        isConnected: () => false,
        async getAllReservations() { return []; },
        async updateStatus() {
            return {ok:false, message:'Reservation status update unavailable.'};
        }
    };
})();
