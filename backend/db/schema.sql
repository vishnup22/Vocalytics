DROP TABLE IF EXISTS summary_product_stats CASCADE;
DROP TABLE IF EXISTS summary_department_stats CASCADE;
DROP TABLE IF EXISTS summary_orders_by_hour CASCADE;
DROP TABLE IF EXISTS summary_orders_by_dow CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS aisles CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

CREATE TABLE departments (
  department_id   INT PRIMARY KEY,
  department_name TEXT NOT NULL
);

CREATE TABLE aisles (
  aisle_id   INT PRIMARY KEY,
  aisle_name TEXT NOT NULL
);

CREATE TABLE products (
  product_id      INT PRIMARY KEY,
  product_name    TEXT NOT NULL,
  aisle_id        INT NOT NULL REFERENCES aisles(aisle_id),
  department_id   INT NOT NULL REFERENCES departments(department_id)
);

CREATE TABLE orders (
  order_id                 INT PRIMARY KEY,
  user_id                  INT NOT NULL,
  eval_set                 TEXT NOT NULL,
  order_number             INT NOT NULL,
  order_dow                SMALLINT NOT NULL,
  order_hour_of_day        SMALLINT NOT NULL,
  days_since_prior_order   NUMERIC(6, 1)
);

CREATE TABLE order_items (
  order_id           INT NOT NULL REFERENCES orders(order_id),
  product_id         INT NOT NULL REFERENCES products(product_id),
  add_to_cart_order  INT NOT NULL,
  reordered          SMALLINT NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE INDEX ON orders (order_dow);
CREATE INDEX ON orders (order_hour_of_day);
CREATE INDEX ON orders (user_id);
CREATE INDEX ON order_items (order_id);
CREATE INDEX ON order_items (product_id);
CREATE INDEX ON products (department_id);
CREATE INDEX ON products (aisle_id);

CREATE TABLE summary_orders_by_dow (
  order_dow    SMALLINT PRIMARY KEY,
  day_name     TEXT NOT NULL,
  order_count  BIGINT NOT NULL
);

CREATE TABLE summary_orders_by_hour (
  order_hour_of_day  SMALLINT PRIMARY KEY,
  order_count        BIGINT NOT NULL
);

CREATE TABLE summary_department_stats (
  department_id    INT PRIMARY KEY REFERENCES departments(department_id),
  department_name  TEXT NOT NULL,
  items_ordered    BIGINT NOT NULL,
  reorder_rate     NUMERIC(8, 4) NOT NULL
);

CREATE TABLE summary_product_stats (
  product_id        INT PRIMARY KEY REFERENCES products(product_id),
  product_name      TEXT NOT NULL,
  department_name   TEXT NOT NULL,
  items_ordered     BIGINT NOT NULL,
  reorder_rate      NUMERIC(8, 4) NOT NULL
);
