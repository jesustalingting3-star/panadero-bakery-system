create database panadero;

Use panadero;

Create table Users (
user_id INT primary key auto_increment ,
username varchar(50) not null unique,
email varchar(100) Not null unique,
password_hash varchar(255) not null,
role enum('Admin', 'Staff', 'Customer') default 'Customer',
created_at datetime default Current_timestamp
);

Select * from Users;

Create table categories (
category_id INT primary key auto_increment,
category_name varchar(50) not null unique,
description Text Null
);

Select * from categories;

Create table bread_products(
product_id INT primary key auto_increment,
category_id INT Not null, foreign key(category_id) references categories(category_id),
product_name varchar(100) not null,
price decimal(10,2) not null,
stock_quantity INT not null default 0,
created_at datetime default current_timestamp
);

Select * from bread_products;