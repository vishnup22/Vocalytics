CREATE TABLE IF NOT EXISTS summary_orders_by_dow (
  order_dow    SMALLINT PRIMARY KEY,
  day_name     TEXT NOT NULL,
  order_count  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS summary_orders_by_hour (
  order_hour_of_day  SMALLINT PRIMARY KEY,
  order_count        BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS summary_department_stats (
  department_id    INT PRIMARY KEY REFERENCES departments(department_id),
  department_name  TEXT NOT NULL,
  items_ordered    BIGINT NOT NULL,
  reorder_rate     NUMERIC(8, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS summary_product_stats (
  product_id        INT PRIMARY KEY REFERENCES products(product_id),
  product_name      TEXT NOT NULL,
  department_name   TEXT NOT NULL,
  items_ordered     BIGINT NOT NULL,
  reorder_rate      NUMERIC(8, 4) NOT NULL
);
