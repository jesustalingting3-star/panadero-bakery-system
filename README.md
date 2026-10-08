# PANADERO Baking System

The updated customer, staff, and admin visual assets are included while the API-connected JavaScript remains backed by the local MySQL database. This package is intended to run on a laptop with Node.js and MySQL; it does not require Vercel or an internet connection for the bakery system itself.

## Setup

1. Create the database and base tables:

   ```bash
   mysql -u root -p < Arambulo-and-galvez.sql
   ```

2. Copy `.env.example` to `.env` and set the MySQL credentials.
3. Install dependencies and start the server:

   ```bash
   npm install
   npm start
   ```

4. Open the role-based login page:
   - Login: `http://localhost:3000/login.html`

   Demo accounts for local testing:
   - Staff: `staff@panadero.local` / `Staff123!`
   - Admin: `admin@panadero.local` / `Admin123!`
   - Customer: create one from `/customer/signup.html` or `/customer/login.html`

5. Open:
   - Customer: `http://localhost:3000/customer/index.html`
   - Staff: `http://localhost:3000/staff/staff-dashboard.html`
   - Admin: `http://localhost:3000/admin/admin.html`

On startup, the server creates the required `reservations` and `inventory_batches` compatibility tables and seeds the bakery categories/products if the supplied database is empty.

Staff and admin pages redirect to the role login page when no valid session is present. Customer orders and reservations also require a signed-in customer account.

## API coverage

- Customer registration, login, logout, password-reset request
- Live product/category catalog and stock availability
- Order creation with order items, total calculation, stock deduction, and order history
- Reservation creation, history, and status updates
- Staff inventory stock updates, fresh-batch recording, request listing, and status updates
- Admin catalog/category/user/stock/request hydration and persistence

Orders and reservations use server-side totals and product prices; browser values are not trusted for pricing.

## What was merged from the October 2026 design ZIP

- Updated customer, staff, and admin CSS files.
- Updated bakery logos, product images, menu-card images, and home slides.
- Added the customer signup page.
- Kept the existing API-backed authentication, catalog, cart, orders, reservations, inventory, and admin/staff JavaScript so data continues to use MySQL instead of browser-only storage.
