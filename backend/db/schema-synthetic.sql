DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS regions CASCADE;

CREATE TABLE regions (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  continent   TEXT NOT NULL
);

CREATE TABLE categories (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL
);

CREATE TABLE products (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  category_id  INT NOT NULL REFERENCES categories(id),
  price        NUMERIC(10,2) NOT NULL,
  cost         NUMERIC(10,2) NOT NULL
);

CREATE TABLE customers (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  region_id   INT NOT NULL REFERENCES regions(id),
  created_at  DATE NOT NULL
);

CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  customer_id  INT NOT NULL REFERENCES customers(id),
  order_date   DATE NOT NULL,
  status       TEXT NOT NULL
);

CREATE TABLE order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INT NOT NULL REFERENCES orders(id),
  product_id  INT NOT NULL REFERENCES products(id),
  quantity    INT NOT NULL,
  unit_price  NUMERIC(10,2) NOT NULL
);

CREATE INDEX ON orders(order_date);
CREATE INDEX ON customers(region_id);
CREATE INDEX ON order_items(order_id);
