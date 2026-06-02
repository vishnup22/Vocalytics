export interface ColumnDef {
  name: string;
  type: string;
  note?: string;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  sampleRows: Record<string, string | number | null>[];
}

export const TABLES: TableDef[] = [
  {
    name: "departments",
    columns: [
      { name: "department_id", type: "int (PK)" },
      { name: "department_name", type: "text", note: "e.g. 'produce', 'dairy eggs'" },
    ],
    sampleRows: [
      { department_id: 3, department_name: "produce" },
      { department_id: 16, department_name: "dairy eggs" },
    ],
  },
  {
    name: "aisles",
    columns: [
      { name: "aisle_id", type: "int (PK)" },
      { name: "aisle_name", type: "text", note: "e.g. 'fresh fruits', 'packaged vegetables fruits'" },
    ],
    sampleRows: [
      { aisle_id: 24, aisle_name: "fresh fruits" },
      { aisle_id: 83, aisle_name: "fresh herbs" },
    ],
  },
  {
    name: "products",
    columns: [
      { name: "product_id", type: "int (PK)" },
      { name: "product_name", type: "text" },
      { name: "aisle_id", type: "int (FK -> aisles.aisle_id)" },
      { name: "department_id", type: "int (FK -> departments.department_id)" },
    ],
    sampleRows: [
      {
        product_id: 49633,
        product_name: "Organic Strawberries",
        aisle_id: 24,
        department_id: 3,
      },
      {
        product_id: 22835,
        product_name: "Organic Whole Milk",
        aisle_id: 83,
        department_id: 16,
      },
    ],
  },
  {
    name: "orders",
    columns: [
      { name: "order_id", type: "int (PK)" },
      { name: "user_id", type: "int", note: "shopper (anonymous id)" },
      {
        name: "eval_set",
        type: "text",
        note: "'prior' | 'train' — which Instacart split this order belongs to",
      },
      {
        name: "order_number",
        type: "int",
        note: "1 = first order for this user, 2 = second, etc.",
      },
      {
        name: "order_dow",
        type: "smallint",
        note: "day of week: 0=Sunday, 1=Monday, … 6=Saturday",
      },
      { name: "order_hour_of_day", type: "smallint", note: "0–23" },
      {
        name: "days_since_prior_order",
        type: "numeric",
        note: "NULL if first order for user",
      },
    ],
    sampleRows: [
      {
        order_id: 2539329,
        user_id: 1,
        eval_set: "prior",
        order_number: 1,
        order_dow: 2,
        order_hour_of_day: 8,
        days_since_prior_order: null,
      },
      {
        order_id: 2398795,
        user_id: 1,
        eval_set: "prior",
        order_number: 2,
        order_dow: 3,
        order_hour_of_day: 7,
        days_since_prior_order: 15,
      },
    ],
  },
  {
    name: "order_items",
    columns: [
      { name: "order_id", type: "int (FK -> orders.order_id)" },
      { name: "product_id", type: "int (FK -> products.product_id)" },
      {
        name: "add_to_cart_order",
        type: "int",
        note: "sequence item was added to cart (1 = first)",
      },
      {
        name: "reordered",
        type: "smallint",
        note: "1 if customer bought this product before, else 0",
      },
    ],
    sampleRows: [
      { order_id: 2539329, product_id: 196, add_to_cart_order: 1, reordered: 0 },
      { order_id: 2539329, product_id: 10246, add_to_cart_order: 2, reordered: 1 },
    ],
  },
  {
    name: "summary_orders_by_dow",
    columns: [
      { name: "order_dow", type: "smallint (PK)" },
      { name: "day_name", type: "text", note: "Sunday … Saturday" },
      { name: "order_count", type: "bigint", note: "USE THIS for day-of-week charts" },
    ],
    sampleRows: [
      { order_dow: 0, day_name: "Sunday", order_count: 610000 },
      { order_dow: 1, day_name: "Monday", order_count: 580000 },
    ],
  },
  {
    name: "summary_orders_by_hour",
    columns: [
      { name: "order_hour_of_day", type: "smallint (PK)", note: "0–23" },
      { name: "order_count", type: "bigint" },
    ],
    sampleRows: [{ order_hour_of_day: 8, order_count: 120000 }],
  },
  {
    name: "summary_department_stats",
    columns: [
      { name: "department_id", type: "int (PK)" },
      { name: "department_name", type: "text" },
      { name: "items_ordered", type: "bigint" },
      { name: "reorder_rate", type: "numeric", note: "0–1" },
    ],
    sampleRows: [
      {
        department_id: 3,
        department_name: "produce",
        items_ordered: 5000000,
        reorder_rate: 0.65,
      },
    ],
  },
  {
    name: "summary_product_stats",
    columns: [
      { name: "product_id", type: "int (PK)" },
      { name: "product_name", type: "text" },
      { name: "department_name", type: "text" },
      { name: "items_ordered", type: "bigint" },
      { name: "reorder_rate", type: "numeric" },
    ],
    sampleRows: [
      {
        product_id: 49633,
        product_name: "Organic Strawberries",
        department_name: "produce",
        items_ordered: 42000,
        reorder_rate: 0.71,
      },
    ],
  },
];

export const BUSINESS_GLOSSARY = `
Dataset: Instacart Market Basket Analysis (real grocery orders). There are NO prices or revenue columns.

IMPORTANT — prefer summary_* tables (pre-aggregated, fast):
- "orders by day of week" → SELECT day_name, order_count FROM summary_orders_by_dow ORDER BY order_dow
- "orders per hour" → SELECT order_hour_of_day, order_count FROM summary_orders_by_hour ORDER BY 1
- "top departments by items ordered" → SELECT department_name, items_ordered FROM summary_department_stats ORDER BY items_ordered DESC LIMIT N
- "reorder rate by department" → SELECT department_name, reorder_rate FROM summary_department_stats ORDER BY reorder_rate DESC
- "top products" → SELECT product_name, items_ordered FROM summary_product_stats ORDER BY items_ordered DESC LIMIT N

Business definitions (use these exactly):
- items_ordered = COUNT(*) FROM order_items (each row is one product line in one order).
- order_count = COUNT(DISTINCT orders.order_id) over the slice you are analyzing.
- basket_size = items_ordered / order_count (average line items per order).
- reorder_rate = AVG(order_items.reordered::numeric) — share of line items that are reorders (0–1). Multiply by 100 for percent if helpful.
- day_name: order_dow 0='Sunday', 1='Monday', 2='Tuesday', 3='Wednesday', 4='Thursday', 5='Friday', 6='Saturday'.
- peak hours: group by orders.order_hour_of_day (0–23).
- department / aisle attribution: order_items -> products -> departments OR products -> aisles.
- filter prior vs train carts: orders.eval_set = 'prior' OR 'train'.
- There is NO calendar order_date — do NOT invent dates or quarters. Use order_dow, order_hour_of_day, order_number, or eval_set instead.
- Top products: GROUP BY products.product_name (or product_id) ORDER BY items_ordered DESC.
`.trim();

export function renderSchemaForPrompt(): string {
  const tableText = TABLES.map((t) => {
    const cols = t.columns
      .map((c) => `    - ${c.name} ${c.type}${c.note ? ` -- ${c.note}` : ""}`)
      .join("\n");
    const samples = t.sampleRows
      .map((r) => `    ${JSON.stringify(r)}`)
      .join("\n");
    return `TABLE ${t.name}\n  columns:\n${cols}\n  sample rows:\n${samples}`;
  }).join("\n\n");

  return `${tableText}\n\n${BUSINESS_GLOSSARY}`;
}
