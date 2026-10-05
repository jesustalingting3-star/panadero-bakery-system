PANADERO — ADMIN FRONTEND

This folder is the Admin-side frontend only.
It uses the same cream / brown / amber PANADERO visual style as the Customer and Staff sites.
No separate Admin login page is included because the project already has a shared login on the customer/system side.

OPEN:
- admin.html
  (single page; sections switch with the nav links, e.g. admin.html#dashboard, #inventory, #orders)

FOLDER STRUCTURE:
- admin.html
- assets/css/admin.css
- assets/js/products.js   (shared catalog, same as Customer/Staff)
- assets/js/admin.js

FRONTEND-ONLY BEHAVIOR:
- Shared stock / batch / order / reservation data uses sessionStorage key: panadero-staff-ui-v2 (same as Staff).
- Admin-only data (catalog edits, users, logs) uses sessionStorage key: panadero-admin-ui-v1.
- No fake customer orders or reservations are created.
- There are no PHP files, endpoint assumptions, MySQL schemas, or API clients.
- Backend developers may replace the store functions in admin.js with their preferred integration later.
