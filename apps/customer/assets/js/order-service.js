(function () {
    window.OrderService = {
        async createOrder() {
            return {
                ok: false,
                code: 'NOT_CONNECTED',
                message: 'Order submission will be connected by the backend team.'
            };
        },

        async getOrders() {
            return [];
        },

        async getOrderById() {
            return null;
        }
    };
})();
