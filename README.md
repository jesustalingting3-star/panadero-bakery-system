# PANADERO Baking System

PANADERO is a local-laptop bakery management system with three role-based portals:

- **Customer** — browse products, place orders, make reservations, and track requests.
- **Staff** — manage inventory batches and update order/reservation statuses.
- **Admin** — manage the catalog, users, stock, and requests.

The frontend design is preserved in the role folders. The frontend communicates with the Node.js/Express API, and all business data is stored in MySQL.

## Quick start on Windows

1. Install Node.js LTS and MySQL or XAMPP.
2. Start MySQL if it is not running.
3. Double-click `PANADERO-ONE-CLICK.bat`.
4. Wait for the browser to open `http://localhost:3000/login.html`.

The launcher imports `database/panadero.sql`, creates `.env` from `.env.example` when needed, installs dependencies, starts the server, waits for `/api/health`, and opens the login page.

## Manual setup

```bash
mysql -u root -p < database/panadero.sql
cp .env.example .env
npm install
npm start
```

Set the MySQL credentials in `.env`. Never commit `.env` because it contains the local database password.

## Portal URLs

- Login: `http://localhost:3000/login.html`
- Customer: `http://localhost:3000/customer/index.html`
- Customer signup: `http://localhost:3000/customer/signup.html`
- Staff: `http://localhost:3000/staff/staff-dashboard.html`
- Admin: `http://localhost:3000/admin/admin.html`

## Demo accounts

- Staff: `staff@panadero.local` / `Staff123!`
- Admin: `admin@panadero.local` / `Admin123!`
- Customer: create an account through the customer signup page.

## Backend/API coverage

- Customer registration, login, logout, and password-reset request
- Live product/category catalog and stock availability
- Transactional order creation, order items, totals, stock deduction, and history
- Reservation creation, history, and status updates
- Staff inventory stock updates, batch recording, request listing, and status updates
- Admin catalog/category/user/stock/request hydration and persistence

The server performs a safe startup migration for compatibility and seeds the initial categories, products, and demo staff/admin accounts when the database is empty.

## Repository organization

```text
PANADERO/
├── PANADERO-COSTUMER/       Customer portal source and assets
├── PANADERO-STAFF/          Staff portal source and assets
├── PANADERO-ADMIN/          Admin portal source and assets
├── database/panadero.sql    Canonical complete MySQL schema
├── docs/                    ERD, master book, guides, and defense reviewer
├── login.html               Root role-selection/login page
├── server.js                Node.js/Express API and static-file server
├── PANADERO-ONE-CLICK.bat   Windows local launcher
├── .env.example             Safe configuration template
└── package.json             Node.js dependencies and scripts
```

See `docs/PANADERO-LOCAL-ERD-UPDATED.md`, `docs/REPOSITORY-STRUCTURE.md`, and `LOCAL-SETUP.md` for detailed documentation.
