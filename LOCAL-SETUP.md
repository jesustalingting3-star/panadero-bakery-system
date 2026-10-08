# PANADERO Local Laptop Setup

## Requirements

- Node.js 18 or newer
- MySQL 8 or MariaDB
- A terminal such as Command Prompt, PowerShell, or Terminal

## 1. Create the database

From the PANADERO project folder, run:

```bash
mysql -u root -p < Arambulo-and-galvez.sql
```

If the MySQL root account has no password, remove `-p`.

On Windows, you can also open `Arambulo-and-galvez.sql` in MySQL Workbench or phpMyAdmin and execute it.

## 2. Configure the local connection

Copy `.env.example` to `.env` and set the local MySQL password:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=panadero_bakery
DB_SSL=false
```

Do not share the `.env` file because it contains your database password.

## 3. Install and start

```bash
npm install
npm start
```

Keep the terminal running while using the system.

## 4. Open the portals

- Login: http://localhost:3000/login.html
- Customer: http://localhost:3000/customer/index.html
- Customer signup: http://localhost:3000/customer/signup.html
- Staff: http://localhost:3000/staff/staff-dashboard.html
- Admin: http://localhost:3000/admin/admin.html

## Demo accounts

- Staff: `staff@panadero.local` / `Staff123!`
- Admin: `admin@panadero.local` / `Admin123!`
- Customer: create an account through the customer signup page

The customer, staff, and admin pages communicate with the local Node.js API. Orders, reservations, inventory, users, and products are stored in MySQL; they are not stored only in browser local storage.
