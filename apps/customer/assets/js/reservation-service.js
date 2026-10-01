(function () {
    window.ReservationService = {
        async createReservation() {
            return {
                ok: false,
                code: 'NOT_CONNECTED',
                message: 'Reservation submission will be connected by the backend team.'
            };
        },

        async getReservations() {
            return [];
        },

        async getReservationById() {
            return null;
        }
    };
})();
