# PANADERO 3–5 Minute System Video Guide

## Purpose

This guide helps the group record the required **3–5 minute CCS110 system video** for the PANADERO Bakeshop Production and Pre-Order System.

The video must be an actual screen recording of the running application connected to MySQL/MariaDB. Do not submit slides-only, animation-only, or mock screenshots.

## Required filename

```text
CCS110_Group#_PANADERO.mp4
```

Replace `Group#` with the real group number, for example:

```text
CCS110_Group3_PANADERO.mp4
```

---

# 1. What the video must show

The video must include all of these items:

- On-screen introduction with system title, group number, section, and member names
- Problem and solution explanation
- Quick tour of the login page and main modules
- One complete live workflow:

```text
Add → Save → Display → Edit → Delete
```

- Database view before and after the transaction
- At least one SQL query executed on screen
- Voice-over explaining what is happening
- Captions or subtitles showing the important actions

## Recommended workflow

Use a **temporary Admin product** so the group can safely demonstrate create, read/display, update, and delete without damaging real products:

```text
Create temporary product → save it → display it in the Admin catalog → edit its price → delete it
```

Suggested temporary product:

```text
Product name: SQL Demo Loaf
Category: Breads
Price: ₱99.00
Stock: 5
```

Use a test database or clearly labeled demo data. Do not delete an actual customer, order, or production record during recording.

---

# 2. Before recording

## Start the application

1. Start **MySQL/MariaDB** using XAMPP.
2. Confirm the `panadero_bakery` database exists.
3. Start the PANADERO Node.js server.
4. Open the login page:

```text
http://localhost:3000/login.html
```

5. Prepare two browser tabs:
   - PANADERO application
   - phpMyAdmin or MySQL Workbench
6. Log in using the prepared Admin test account.
7. Prepare the SQL query below in phpMyAdmin/Workbench, but do not run it until the script reaches that step.

## Suggested test accounts

Use the project’s local demo account only in a local recording environment:

```text
Admin email: admin@panadero.local
Admin password: Admin123!
```

If the group changed the password, use the updated test account instead.

## Prepare the database screen

Open the `bread_products` table and show the initial state before creating the temporary product.

Use a filter/search for:

```text
SQL Demo Loaf
```

The expected initial result is **no matching record**.

Do not show real customer emails, personal data, database passwords, `.env` contents, or password hashes on screen.

---

# 3. Complete timed video plan

Target length: approximately **4 minutes**.

| Time | Screen action | Voice-over / narration |
|---|---|---|
| 0:00–0:20 | Show title card with group information | Read the introduction script below. |
| 0:20–0:45 | Show login page and briefly show Customer, Staff, and Admin portal links/modules | Explain the problem and solution. |
| 0:45–1:10 | Log in as Admin and show the dashboard/catalog | Give the quick interface tour. |
| 1:10–1:25 | Switch to MySQL/Workbench and show no `SQL Demo Loaf` row | Explain the database state before the transaction. |
| 1:25–2:05 | Add the temporary product in Admin, save it, return to product list, and display it | Demonstrate Add → Save → Display. |
| 2:05–2:35 | Edit the product price, save, refresh/display the changed product | Demonstrate Edit and explain the database update. |
| 2:35–2:55 | Delete the temporary product and confirm the deletion | Demonstrate Delete. |
| 2:55–3:25 | Refresh MySQL/Workbench and show the record is gone; show a related database table if available | Demonstrate the database after the transaction. |
| 3:25–3:50 | Execute the sample SQL query and show the results | Explain the SQL query. |
| 3:50–4:10 | Show the main modules again and a conclusion card | Summarize the complete UI → API → database flow. |

The exact duration may be between **3 and 5 minutes**. Keep the screen recording moving; do not leave long pauses while pages load.

---

# 4. Ready-to-read narration script

## Scene 1 — Introduction: 0:00–0:20

**On-screen title:**

```text
PANADERO Bakeshop Production and Pre-Order System
CCS110 Information Management 1
Group [GROUP NUMBER] | Section [SECTION]
Members: [MEMBER 1], [MEMBER 2], [MEMBER 3], [MEMBER 4], [MEMBER 5]
```

**Voice-over:**

> Good day. We are Group [GROUP NUMBER] from Section [SECTION]. This is PANADERO, our bakeshop production and pre-order system for CCS110 Information Management 1. Our members are [read the member names]. This video demonstrates the running system, its database integration, and one complete CRUD workflow.

## Scene 2 — Problem and solution: 0:20–0:45

Show the login page and the main portal choices.

**Voice-over:**

> A bakeshop needs to manage products, stock, customer orders, reservations, and production batches. Manual records can cause incorrect stock quantities, lost requests, and inconsistent status updates. PANADERO solves this by connecting Customer, Staff, and Admin web portals to a Node.js and Express API with a MySQL database. The server validates requests and stores the official records.

**Caption:**

```text
Problem: manual and disconnected bakery records
Solution: role-based portals connected to a centralized MySQL database
```

## Scene 3 — Quick interface tour: 0:45–1:10

Log in as Admin. Show the dashboard, catalog/products area, and one additional module. If time permits, briefly show the Customer and Staff portal pages without performing another full workflow.

**Voice-over:**

> The system has three main user areas. Customers can browse products, use a cart, place orders or reservations, and track their requests. Staff can manage stock, record inventory batches, and update request statuses. Administrators can manage products, categories, users, inventory, and requests. I will now demonstrate an Admin product CRUD workflow connected to the database.

**Captions:**

```text
Customer: ordering, reservations, tracking
Staff: inventory and request processing
Admin: catalog, users, stock, and request management
```

## Scene 4 — Database before: 1:10–1:25

Open phpMyAdmin or MySQL Workbench. Select the `panadero_bakery` database and search the `bread_products` table for `SQL Demo Loaf`.

**Voice-over:**

> Before adding the test record, I am checking the `bread_products` table. There is no record named SQL Demo Loaf. This is the database state before the transaction.

**Caption:**

```text
BEFORE: SQL Demo Loaf does not exist in bread_products
```

## Scene 5 — Add, save, and display: 1:25–2:05

Return to Admin:

1. Open the product management screen.
2. Click Add Product.
3. Enter `SQL Demo Loaf`.
4. Select `Breads`.
5. Enter price `99.00`.
6. Enter stock `5` if the form includes stock.
7. Click Save.
8. Show the success message.
9. Show the product in the product list.
10. Refresh the page if needed and show that it remains displayed.

**Voice-over:**

> I am adding a temporary test product named SQL Demo Loaf under the Breads category with a price of 99 pesos and an initial stock of 5. After I select Save, the Admin interface sends the data to the Express API. The API validates the input and inserts the product into the database. The product now appears in the catalog, which demonstrates Add, Save, and Display.

**Caption:**

```text
ADD → SAVE → DISPLAY
Product saved to bread_products
```

## Scene 6 — Edit: 2:05–2:35

Edit the product price from `99.00` to `109.00`. Save it. Show the updated product in the list.

**Voice-over:**

> I will now edit the temporary product and change its price from 99 pesos to 109 pesos. After saving, the API updates the matching database row using its product ID. The displayed product now shows the updated price, proving that the edit was persisted rather than changing only the browser screen.

**Caption:**

```text
EDIT: price ₱99.00 → ₱109.00
Database row updated by product_id
```

## Scene 7 — Delete: 2:35–2:55

Delete `SQL Demo Loaf`. Confirm the deletion. Show that it disappears from the Admin product list.

**Voice-over:**

> Finally, I am deleting the temporary SQL Demo Loaf record. I confirm the action, and the application sends a delete request for that product ID. The product is removed from the Admin list. This completes the Add, Save, Display, Edit, and Delete workflow.

**Caption:**

```text
DELETE: temporary test product removed
```

## Scene 8 — Database after: 2:55–3:25

Return to MySQL/Workbench. Refresh/search `bread_products` for `SQL Demo Loaf`. Show no result. If available, show the SQL result/history or affected-row count.

**Voice-over:**

> I am checking the database again after the workflow. SQL Demo Loaf is no longer in `bread_products`, confirming that the delete operation was saved in MySQL. This demonstrates the complete flow from the user interface, through the backend API, into the database, and back to the user interface.

**Caption:**

```text
AFTER: SQL Demo Loaf no longer exists in bread_products
UI → Express API → MySQL → updated UI
```

## Scene 9 — SQL query execution: 3:25–3:50

Run this read-only query in MySQL/Workbench:

```sql
SELECT
    c.category_name,
    p.product_name,
    p.price,
    p.stock_quantity
FROM categories AS c
JOIN bread_products AS p
    ON p.category_id = c.category_id
WHERE p.stock_quantity > 0
ORDER BY c.category_name, p.product_name;
```

**Voice-over:**

> This is a sample SQL SELECT query. It joins categories and bread_products, filters products with stock greater than zero, and orders the result by category and product name. The result shows how related tables support the catalog displayed by the application.

**Caption:**

```text
SQL DEMONSTRATION: SELECT + JOIN + WHERE + ORDER BY
```

## Scene 10 — Conclusion: 3:50–4:10

Show a final title card or the Admin dashboard.

**Voice-over:**

> In summary, PANADERO provides role-based bakery management with a connected frontend, backend, and relational database. We demonstrated the problem and solution, the main user modules, a complete CRUD workflow, database changes before and after the transaction, and a working SQL query. Thank you.

**Final caption:**

```text
PANADERO — Connected UI, API, and MySQL database
Thank you
```

---

# 5. How to record the video

## Recommended tools

Use any screen recorder available to the group, such as:

- OBS Studio
- Windows Game Bar
- Zoom recording
- Google Meet recording
- A phone camera pointed at the monitor, only if screen recording is not possible

A direct screen recording is preferred because the professor specifically requires an actual recording of the working system.

## Recording settings

- Format: MP4
- Resolution: 1280×720 or higher
- Use readable browser zoom, preferably 100% or 110%
- Record both the PANADERO browser window and the MySQL/phpMyAdmin window
- Turn on microphone recording for narration, or add a clear voice-over during editing
- Add captions for the important actions
- Hide unrelated tabs, notifications, email addresses, passwords, and `.env` files

## Recording tips

- Rehearse the entire workflow once before recording.
- Use a temporary product so the delete step is safe.
- Keep the mouse cursor visible when clicking Save, Edit, and Delete.
- Pause for one or two seconds after each successful action so the viewer can read the result.
- Do not show database passwords or real customer information.
- If an error occurs, stop and record that scene again instead of leaving a long error in the final video.
- Keep the total video between 3 and 5 minutes.

---

# 6. Final checklist before submission

## Video content

- [ ] MP4 file is 3–5 minutes long.
- [ ] System title is visible.
- [ ] Group number is visible.
- [ ] Section is visible.
- [ ] All member names are visible.
- [ ] Problem and solution are explained.
- [ ] Login and main modules are shown.
- [ ] Add → Save → Display → Edit → Delete workflow is shown.
- [ ] Database is shown before the transaction.
- [ ] Database is shown after the transaction.
- [ ] At least one SQL query is executed on screen.
- [ ] Voice-over is understandable.
- [ ] Captions explain the important steps.
- [ ] No passwords, `.env` data, or private customer information are visible.

## Submission details

- [ ] Filename follows `CCS110_Group#_PANADERO.mp4`.
- [ ] The MP4 is uploaded to the required Google Drive folder or unlisted YouTube.
- [ ] The video link is accessible without requesting permission.
- [ ] The link is included in the final submission document and presentation slides.
- [ ] The group tested the link using a private/incognito browser window.

> Important: This 3–5 minute clip is separate from the longer live presentation or oral defense. The group should still prepare for the required 20-minute presentation and 10-minute Q&A.
