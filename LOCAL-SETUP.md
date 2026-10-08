# PANADERO Local Laptop Setup

## Requirements

- Node.js 18 or newer
- MySQL 8 or MariaDB
- Windows Command Prompt, PowerShell, or a terminal

## Fastest option: one-click Windows setup

1. Start **MySQL** in XAMPP, if it is not already running.
2. Double-click `PANADERO-ONE-CLICK.bat`.
3. The launcher imports `database/panadero.sql`, installs Node packages, starts the server, checks the database health endpoint, and opens the login page.
4. Use `http://localhost:3000/login.html`.

The launcher searches for MySQL in PATH, XAMPP, and common MySQL installation folders. If the root account has a password, it asks for it during setup. The launcher preserves an existing `.env` file.

The launcher requires Node.js to already be installed. It cannot install Node.js or MySQL.

## Manual setup

From the project folder:

```bash
mysql -u root -p < database/panadero.sql
copy .env.example .env       # Windows
# or: cp .env.example .env   # macOS/Linux
npm install
npm start
```

If the MySQL root account has no password, omit `-p`. Set the real local credentials in `.env`:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=panadero_bakery
DB_SSL=false
```

Do not share or commit `.env`.

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

## Troubleshooting

- If `/api/health` reports a database error, confirm that MySQL is running and that `.env` matches the MySQL account.
- If port 3000 is busy, close the other Node.js process or change `PORT` in `.env` and update the URL.
- Keep the server terminal open while using the portals.

All active portal files are under `PANADERO-COSTUMER`, `PANADERO-STAFF`, and `PANADERO-ADMIN`. The old duplicate `apps/` prototype and role ZIP archives are not part of the organized repository.
