# PANADERO Baking System

PANADERO is a local-laptop bakery management system with three role-based portals:

- **Customer** — browse products, place orders, make reservations, and track requests.
- **Staff** — manage inventory batches and update order/reservation statuses.
- **Admin** — manage the catalog, users, stock, and requests.

The frontend communicates with the Node.js/Express API. Accounts, product catalog, inventory, orders, checkout method/address, selected payment method, reservations, customer notifications, and admin changes are stored in MySQL. Customer saved-address presets and some convenience preferences remain in browser storage.

## Quick start on Windows

1. Install Node.js LTS and XAMPP (with MariaDB).
2. Start MySQL from the **XAMPP Control Panel**. Do not start another MySQL service on port 3306.
3. Double-click `PANADERO-ONE-CLICK.bat`.
4. Wait for the browser to open `http://localhost:3000/customer/login.html`.

The launcher checks that port 3306 really belongs to `C:\xampp\mysql\data`, backs up an existing `panadero_bakery` database before any import, imports the non-destructive `database/panadero.sql` schema, updates local `.env`, installs Node packages if needed, starts PANADERO, checks `/api/health`, and opens the Customer login page. **It never starts/stops/repairs XAMPP MySQL.**

## Manual setup

```bash
mysql -u root -p < database/panadero.sql
cp .env.example .env
npm install
npm start
```

Set the MySQL credentials in `.env`. Never commit `.env` because it contains the local database password.

## Portal URLs

- Login: `http://localhost:3000/customer/login.html`
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

The server adds missing checkout/contact columns to existing databases without resetting records. The canonical SQL now includes fictional rubric sample records with initial stock and demo Staff/Admin accounts. A seed marker prevents deleted demo rows from returning on every restart. Change or remove demo accounts before public deployment. See `docs/AUDIT-REPORT.md` for verification and remaining limitations.

## Repository organization

```text
PANADERO/
├── PANADERO-COSTUMER/       Customer portal source and assets
├── PANADERO-STAFF/          Staff portal source and assets
├── PANADERO-ADMIN/          Admin portal source and assets
├── database/panadero.sql    Canonical schema plus rubric sample data
├── docs/
│   ├── submission/          Current editable Word files and video guide
│   ├── screenshots/         Current interface screenshots
│   ├── CONTRIBUTIONS-AND-ROLES.md
│   ├── FINAL-SUBMISSION-CHECKLIST.md
│   └── archive/              Preserved older PDFs and database backups
├── 02_Documentation/        Pointer to current editable documentation
├── database_backups/        Pointer to preserved database backups
├── login.html               Compatibility redirect only
├── server.js                Express API and static-file server
├── PANADERO-ONE-CLICK.bat   Windows local launcher
├── .env.example             Safe configuration template
└── package.json              Node.js dependencies and scripts
```

## Current member work

See [`docs/CONTRIBUTIONS-AND-ROLES.md`](docs/CONTRIBUTIONS-AND-ROLES.md) for the group’s stated role assignments and short contribution descriptions.

## Submission documents

Use the editable files in [`docs/submission/`](docs/submission/), especially the rubric form, the three system documentation files, the contribution/challenges file, and the video guide. See [`docs/FINAL-SUBMISSION-CHECKLIST.md`](docs/FINAL-SUBMISSION-CHECKLIST.md) before submitting.
