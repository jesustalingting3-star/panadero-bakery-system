# PANADERO Database ERD

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
        ENUM role
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
        ENUM order_status
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
        ENUM reservation_status
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

## Relationship summary

- `USERS` → `ORDERS`: one customer can place many orders.
- `USERS` → `RESERVATIONS`: one customer can make many reservations.
- `CATEGORIES` → `BREAD_PRODUCTS`: each category contains many products.
- `ORDERS` → `ORDER_ITEMS`: each order contains one or more line items.
- `BREAD_PRODUCTS` → `ORDER_ITEMS`: one product can be sold in many orders.
- `BREAD_PRODUCTS` → `RESERVATIONS`: one product can be reserved many times.
- `BREAD_PRODUCTS` → `INVENTORY_BATCHES`: one product can have many baking batches.
- `USERS` → `SYSTEM_LOGS`: a user can create many audit log entries.

`RESERVATIONS` and `INVENTORY_BATCHES` are the two compatibility tables created by `server.js` because they are needed by the existing pages but are not included in the supplied SQL file.
