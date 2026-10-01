# Panadero Bakery System

Panadero is a web application prototype for a bakery's customer ordering flow and day-to-day staff and admin operations.

This repository contains three static, browser-run role applications and a reference SQL schema. It is a prototype, not a production service.

## Applications

- **Customer** — product browsing, cart/checkout, order and reservation screens.
- **Staff** — operational dashboard, inventory, and order screens.
- **Admin** — product/catalogue administration screens.

## Repository structure

```text
apps/customer/   Customer HTML, CSS, and JavaScript
apps/staff/      Staff HTML, CSS, and JavaScript
apps/admin/      Admin HTML, CSS, JavaScript, and role notes
database/        SQL schema source
docs/            System overview and database schema PDFs
```

## Run locally

From the repository root, start a simple static web server:

```bash
python3 -m http.server 8000
```

Then open the role pages in a browser:

- Customer: <http://localhost:8000/apps/customer/>
- Staff: <http://localhost:8000/apps/staff/staff-dashboard.html>
- Admin: <http://localhost:8000/apps/admin/admin.html>

No build step or package installation is required for these static pages. Use a local HTTP server rather than opening the files directly if browser restrictions block local assets or scripts.

## Database and prototype limitations

`database/001_schema.sql` contains the project's SQL schema for users, product categories, and bread products. The current front ends are not connected to a production backend, API, or live database; the SQL file is included as a schema reference, not as an active connection configuration.

The browser apps use `localStorage` and/or `sessionStorage` for prototype state where implemented. That state is local to the browser and is not shared across devices or backed up by a server. Browser storage is not an appropriate production authentication or persistence layer.

A production release would need a secured backend/API, server-side authentication and authorization, validation, and database persistence. Do not put credentials in client-side code.