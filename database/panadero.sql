CREATE DATABASE IF NOT EXISTS panadero_bakery;
USE panadero_bakery;

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    mobile VARCHAR(11) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'Staff', 'Customer') NOT NULL DEFAULT 'Customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bread_products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    delivery_method VARCHAR(12) NULL,
    delivery_address VARCHAR(500) NULL,
    recipient_name VARCHAR(100) NULL,
    recipient_mobile VARCHAR(11) NULL,
    payment_method VARCHAR(12) NULL,
    order_status ENUM('Pending', 'Processing', 'Ready', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (product_id) REFERENCES bread_products(product_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    preferred_date DATE NOT NULL,
    preferred_time TIME NOT NULL,
    reservation_status ENUM('Pending', 'Processing', 'Ready', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
    reservation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (product_id) REFERENCES bread_products(product_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_batches (
    batch_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    baked_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    notes VARCHAR(500) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES bread_products(product_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action_type VARCHAR(50) NOT NULL,
    description TEXT NULL,
    log_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Stored per-customer completion notifications (safe on an existing PANADERO database).
CREATE TABLE IF NOT EXISTS customer_notifications (
    notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    request_type ENUM('order', 'reservation') NOT NULL,
    request_id INT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_customer_completion (user_id, request_type, request_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Categories, products, and demo staff/admin accounts are seeded by server.js on startup.

-- Startup seed marker: once initial catalog/accounts are created they are not recreated after deletion.
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CCS110 SAMPLE DATA
-- Fictional records for demonstration and rubric compliance.
-- The explicit IDs make repeated local imports harmless through INSERT IGNORE.
-- Change or remove demo passwords before any public deployment.
INSERT IGNORE INTO categories (category_id, category_name, description) VALUES
(1,'Breads','Fresh breads'),(2,'Cakes','Cakes and cheesecakes'),
(3,'Doughnuts','Doughnuts and pastries'),(4,'Pies','Fresh pies'),
(5,'Seasonal Specials','Limited-time bakery products');

INSERT IGNORE INTO bread_products (product_id, category_id, product_name, price, stock_quantity) VALUES
(1,1,'Baguette',65.00,20),(2,1,'Croissant',55.00,18),(3,1,'Pan de Sal',5.00,50),
(4,1,'Cinnamon Roll',45.00,15),(5,2,'Chocolate Cake',450.00,8),(6,2,'Lemon & Lime Cheesecake',650.00,6),
(7,2,'Chiffon Cake',350.00,10),(8,3,'Bavarian-Filled Doughnut',35.00,24),(9,3,'Beignet',30.00,22),
(10,3,'Long John',35.00,20),(11,3,'Cruller',35.00,20),(12,4,'Apple Pie',300.00,7),
(13,4,'Blueberry Pie',350.00,7),(14,4,'Egg Pie',250.00,9),(15,5,'Lemon Meringue Pie',350.00,5);

-- These bcrypt hashes are for local sample accounts only.
INSERT IGNORE INTO users (user_id, username, email, mobile, password_hash, role) VALUES
(1,'System Admin','admin@panadero.local','09170000001','$2a$12$g8kaZ9Kc48jl0v0r/z.ZzuN4fV2El9SKczQrtikDlFSVHNa1quv0C','Admin'),
(2,'Bakery Staff','staff@panadero.local','09170000002','$2a$12$c6uBdUFVEkrJh5AtQNEhQOj2OaCPaUfw7Xf2j9wlhOPbeHEi3NiJy','Staff'),
(3,'Demo Customer One','demo.customer1@panadero.local','09170000003','$2a$12$RObjsZF7QzBbl1NnOE90EuO/23HqF4FlxEtVwRLfMMMd6h8cDuACW','Customer'),
(4,'Demo Customer Two','demo.customer2@panadero.local','09170000004','$2a$12$CsVzJ0CVoabAyS9OptIBsOxnZP/J83BNJQIt5rQepDmp01Yf/Son.','Customer'),
(5,'Demo Customer Three','demo.customer3@panadero.local','09170000005','$2a$12$KNJH2XJUqF0T3.YNTUuR4utCYrbPs43FHMvXI6TXPUbMAoIfLk722','Customer');

INSERT IGNORE INTO orders (order_id,user_id,total_amount,delivery_method,delivery_address,recipient_name,recipient_mobile,payment_method,order_status) VALUES
(1,3,65.00,'Pickup',NULL,'Demo Customer One','09170000003','Cash','Completed'),
(2,4,110.00,'Delivery','Cabuyao, Laguna','Demo Customer Two','09170000004','GCash','Pending'),
(3,5,450.00,'Pickup',NULL,'Demo Customer Three','09170000005','Cash','Processing'),
(4,3,300.00,'Delivery','Banay-banay, Cabuyao','Demo Customer One','09170000003','Card','Ready'),
(5,4,70.00,'Pickup',NULL,'Demo Customer Two','09170000004','Cash','Cancelled');
INSERT IGNORE INTO order_items (order_item_id,order_id,product_id,quantity,unit_price) VALUES
(1,1,1,1,65.00),(2,2,2,2,55.00),(3,3,5,1,450.00),(4,4,12,1,300.00),(5,5,3,4,5.00);

INSERT IGNORE INTO reservations (reservation_id,user_id,product_id,quantity,total_amount,preferred_date,preferred_time,reservation_status) VALUES
(1,3,7,1,350.00,'2026-11-01','09:00:00','Pending'),
(2,4,5,1,450.00,'2026-11-02','10:00:00','Processing'),
(3,5,12,1,300.00,'2026-11-03','11:00:00','Ready'),
(4,3,6,1,650.00,'2026-11-04','13:00:00','Completed'),
(5,4,13,1,350.00,'2026-11-05','14:00:00','Cancelled');

INSERT IGNORE INTO inventory_batches (batch_id,product_id,quantity,baked_date,expiration_date,notes) VALUES
(1,1,20,'2026-10-10','2026-10-13','Morning baguette batch'),
(2,2,18,'2026-10-10','2026-10-13','Croissant batch'),
(3,5,8,'2026-10-10','2026-10-15','Chocolate cake batch'),
(4,8,24,'2026-10-10','2026-10-12','Doughnut batch'),
(5,12,7,'2026-10-10','2026-10-16','Apple pie batch');

INSERT IGNORE INTO system_logs (log_id,user_id,action_type,description) VALUES
(1,1,'LOGIN','Demo Admin signed in'),(2,2,'INVENTORY_UPDATE','Demo Staff recorded a new batch'),
(3,1,'PRODUCT_CREATE','Demo Admin added a catalog product'),(4,2,'ORDER_STATUS','Demo Staff updated an order status'),
(5,1,'REPORT_VIEW','Demo Admin viewed the sales and activity summary');

INSERT IGNORE INTO customer_notifications (notification_id,user_id,request_type,request_id,is_read) VALUES
(1,3,'order',1,1),(2,4,'order',2,0),(3,5,'order',3,0),(4,3,'reservation',4,1),(5,4,'reservation',5,0);
