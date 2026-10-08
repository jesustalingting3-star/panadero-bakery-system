# PANADERO Local System — Updated ERD

This diagram describes the local MySQL database used by `server.js`. The supplied SQL creates the core tables. The Node.js startup migration creates `reservations` and `inventory_batches` when they are missing because the staff and customer features require them.

```mermaid
erDiagram
    USERS ||--o{ ORDERS : places
    USERS ||--o{ RESERVATIONS : makes
    USERS ||--o{ SYSTEM_LOGS : creates
    CATEGORIES ||--o{ BREAD_PRODUCTS : contains
    BREAD_PRODUCTS ||--o{ ORDER_ITEMS : appears_in
    ORDERS ||--|{ ORDER_ITEMS : contains
    BREAD_PRODUCTS ||--o{ RESERVATIONS : reserved_as
    BREAD_PRODUCTS ||--o{ INVENTORY_BATCHES : baked_in

    USERS {
        INT user_id PK
        VARCHAR username
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
- One order has one or more order items.
- One product can appear in many order items.
- One product can be reserved many times.
- One product can have many inventory batches.
- `order_items.unit_price` preserves the price used at checkout even if the catalog price changes later.
- Current stock is stored in `bread_products.stock_quantity`.
- A new inventory batch increases the product's current stock.
- A successful order or reservation decreases current stock inside a database transaction.

## Runtime-only data not represented in the ERD

- Browser cart: stored temporarily in browser local storage until checkout.
- Browser login session: the browser stores a token, while the current Node.js process keeps the token-to-user session in memory.
- API requests: not database tables; they are HTTP requests handled by Express.
- Product image paths: served as local static assets and are not stored in the database.
