# PANADERO full-code audit (2026-10-11)

## Scope and verification

Audited latest version based on **PANADERO-RECEIPT-CART-PERSISTENCE-FIXED.zip**. Checked Customer, Staff, Admin, `server.js`, `database/panadero.sql`, and the XAMPP-safe BAT launcher. Ran JavaScript syntax checks on **31** files, checked local references on **17** HTML pages, parsed **9** CSS stylesheets, verified **41** raster images, checked **13** code-level regressions, exercised **9** mocked status-transition cases, and exercised **4** mocked Admin API cases. The checks passed. These are code/static and mocked logic checks; the real XAMPP database and Windows launcher could **not** be tested here.

## Fixes made

1. **Customer cancel button:** Added its missing backend API and `OrderService.cancelOrder()` implementation. Only the owner of a Pending order can cancel. Reserved stock is returned once, in the same database transaction.
2. **Admin cancellations:** Restores stock for cancelled orders/reservations. Invalid status skips and changes after Completed/Cancelled are rejected. Completion creates customer-only MySQL notifications transactionally.
3. **Order creation:** Validates numeric product IDs, item quantities, availability, delivery choices and payment selection; combines repeated product IDs before testing stock so duplicate line items cannot overdraw inventory. Totals remain server calculated.
4. **Checkout details:** Saves selected pickup/delivery mode, recipient and delivery address, and chosen Cash/Card/GCash method to MySQL. Customer receipt, order history, Staff and Admin can read them from the database. This is a selected payment method only; it is **not** a completed online payment.
5. **Reservations:** Includes date and time in the server response for history and Staff/Admin dashboards; validates scheduled date/time on the server. Reservations still do not ask for payment.
6. **Signup/contact:** Adds backend name/email/mobile/password validation and stores customer mobile number in MySQL. Removing the accidental uniqueness requirement on display names allows people with the same name to register under different email addresses.
7. **Staff inventory:** Waits for successful API writes before displaying stock/batch success, and re-fetches actual server inventory. Corrects numeric category filtering and product image selection.
8. **Admin CRUD:** Replaced browser-only silent catalog, category, user, batch, and stock changes with authenticated validated MySQL actions. Admin now reloads actual database state after successful writes. Creating a Staff/Admin account requires specifying an initial password. Role changes invalidate previous sessions. Historical completed orders cannot be silently deleted; cancelled requests may be removed with confirmation. Logs persist in `system_logs`.
9. **Receipt and cart:** Kept receipt/print and cart persistence. Receipts now prefer server-stored delivery/payment details. Corrected duplicate order-history filter listeners, added a real cancel failure message, and escaped product text in dynamically rendered HTML.
10. **Startup/catalog:** New installations start with product stock **0** rather than fabricated 100-piece quantities; saved stock on existing databases is never changed by this update. Seeded catalog and demo Staff/Admin accounts are inserted only once, not resurrected after deliberate deletion.
11. **Local safety:** The BAT retains its XAMPP data-dir verification, backup-before-schema-import, and no-XAMPP-service-control rules. Node binds to localhost. Launcher and `/api/build` versions match.

## Preserved features

One Customer login form with role-based redirects; responsive Staff/Admin sidebars; signup validation; cart persistence across pages; Pandesal and other local product images; saved addresses with Philippine location selectors; order receipts and Print/Save PDF; order/reservation redirection; confirmation dialogs; MySQL-based customer completion notifications; and Staff/Admin Pending → Preparing → Ready → Completed status workflow.

## Existing database migration

After the backup, the app adds missing `users.mobile` and `orders` checkout-detail columns **only when absent**, plus the non-destructive startup seed-marker table. It does **not** drop/reset users, orders, sales, stock or notifications. The initial SQL schema was updated for new databases. Existing prior orders may not have historical delivery/payment details to recover.

## Remaining limitations / manual checks

- **Live integration:** Real sign-in, customer checkout, cancellation, Admin CRUD, stock calculation, notification delivery, and concurrent editing must be tested against the user's running XAMPP MariaDB on port 3306. Syntax and mock tests are **not** a substitute for those tests.
- **Saved-address presets** and customer convenience preferences remain browser-local (per account). They will not automatically sync across different devices.
- **Payment** is a method selection only; no live card or GCash charge, payment gateway, bank authorization, or payment capture is implemented. Do not present receipts as payment confirmation.
- **Forgot password** currently records/gives a request message; it is not an email-based password reset service.
- **Demo Admin/Staff accounts** have known default passwords for local setup. Change/remove these accounts before public deployment. The app is intended for localhost, not internet production.
- Existing `docs/` defense PDFs/ER diagrams may reflect an older schema; use current `database/panadero.sql` and MySQL Workbench `SHOW CREATE TABLE` as the structural source of truth.

## Recommended XAMPP regression test

1. Back up `panadero_bakery` first. Start MariaDB **manually in XAMPP**. Stop any old PANADERO Node server, extract this ZIP into a fresh folder, and run its safe BAT.
2. Open Workbench → `panadero_bakery`; confirm existing customer/stock/order data remains intact and new columns are present.
3. Log in as Staff and add stock (new databases start at zero); verify in Workbench.
4. Sign up as a customer, log in, place an order, confirm redirect/receipt/cart clearance; refresh My Orders and Staff/Admin. Confirm payment and delivery details persist.
5. Cancel a **Pending** customer order, verify it becomes Cancelled and stock increases exactly once; do not cancel an already completed order.
6. Place another order and move its status in Staff/Admin: Pending → Preparing → Ready → Completed. Confirm the Customer bell notifies only the correct signed-in account.
7. Test Admin adding/editing categories and products, updating stock, creating Staff accounts with password, and refreshing the page to verify MySQL persistence. Test on mobile width too.
8. Keep the XAMPP Control Panel in charge of MySQL. Never run old BAT launchers that auto-start/stop the service.
