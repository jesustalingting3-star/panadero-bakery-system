# PANADERO Local System — Canonical ERD

This is the canonical entity-relationship diagram for the local MySQL database `panadero_bakery`. It matches `database/panadero.sql` and the compatibility migrations in `server.js`.

```mermaid
erDiagram
    USERS ||--o{ ORDERS : places
    USERS ||--o{ RESERVATIONS : makes
    USERS ||--o{ SYSTEM_LOGS : creates
    CATEGORIES ||--o{ BREAD_PRODUCTS : contains
    BREAD_PRODUCTS ||--o{ ORDER_ITEMS : appears_in
    ORDERS ||--|{ ORDER_ITEMS : contains
    BREAD_PRODUCTS ||--o{ RESERVATIONS : reserved_as
    BREAD_PRODUCTS ||--o{ INVENTORY_BATCHES : tracked_in

    USERS {
        INT user_id PK
        VARCHAR username UK
        VARCHAR email UK
        VARCHAR password_hash
        ENUM role "Admin | Staff | Customer"
        DATETIME created_at
    }

    CATEGORIES {
        INT category_id PK
        VARCHAR category_name UK
        TEXT description
    }

    BREAD_PRODUCTS {
        INT product_id PK
        INT category_id FK
        VARCHAR product_name
        DECIMAL price
        INT stock_quantity
        DATETIME created_at
    }

    ORDERS {
        INT order_id PK
        INT user_id FK
        DECIMAL total_amount
        ENUM order_status "Pending | Processing | Ready | Completed | Cancelled"
        DATETIME order_date
    }

    ORDER_ITEMS {
        INT order_item_id PK
        INT order_id FK
        INT product_id FK
        INT quantity
        DECIMAL unit_price
    }

    RESERVATIONS {
        INT reservation_id PK
        INT user_id FK
        INT product_id FK
        INT quantity
        DECIMAL total_amount
        DATE preferred_date
        TIME preferred_time
        ENUM reservation_status "Pending | Processing | Ready | Completed | Cancelled"
        DATETIME reservation_date
    }

    INVENTORY_BATCHES {
        INT batch_id PK
        INT product_id FK
        INT quantity
        DATE baked_date
        DATE expiration_date
        VARCHAR notes
        DATETIME created_at
    }

    SYSTEM_LOGS {
        INT log_id PK
        INT user_id FK
        VARCHAR action_type
        TEXT description
        DATETIME log_date
    }
```

## Relationship interpretation

- One user can place many orders.
- One user can make many reservations.
- One user can create many system-log records.
- One category contains many products.
- One order contains one or more order items.
- One product can appear in many order items.
- One product can be reserved many times.
- One product can have many inventory batches.
- `order_items.unit_price` preserves the price used at checkout even if the catalog price changes later.
- Current sellable stock is stored in `bread_products.stock_quantity`.
- Adding an inventory batch increases current product stock.
- A successful order or reservation decreases stock inside a database transaction.
- `system_logs` is included for audit history; the current application returns an empty log list until audit writes are added.

## Schema source and runtime migration

- **Canonical import file:** `database/panadero.sql`
- **Runtime compatibility:** `server.js` uses `CREATE TABLE IF NOT EXISTS` for `reservations` and `inventory_batches`, so an older database can still start safely.
- **Seed behavior:** `server.js` creates the initial categories, products, and demo Staff/Admin accounts when the corresponding tables are empty.

## Runtime-only data not shown in the ERD

- Browser cart: temporary local storage until checkout.
- Browser login session: token kept in browser storage; token sessions are held in the running Node.js process.
- API requests: HTTP messages handled by Express, not database tables.
- Product images: local static assets, not database records.
