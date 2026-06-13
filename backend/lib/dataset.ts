export interface ColumnDef {
  name: string;
  type: string;
  note?: string;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  sampleRows: Record<string, unknown>[];
}

export interface RetrievalRule {
  pattern: string;
  tables: string[];
}

export interface ExampleQuestion {
  text: string;
  tag: string;
}

export interface EvalCase {
  id: string;
  question: string;
  context?: {
    question: string;
    sql?: string | null;
    chartTitle?: string | null;
    columns?: string[];
    summary?: string | null;
  }[];
  expectedTables: string[];
  expectedChartType?: string;
  shouldClarify: boolean;
}

export interface DatasetConfig {
  id: string;
  name: string;
  description: string;
  unavailableConcepts: string[];
  tables: TableDef[];
  glossary: string;
  retrievalRules: RetrievalRule[];
  exampleQuestions: ExampleQuestion[];
  evalCases: EvalCase[];
  demoRows: Record<string, Record<string, unknown>[]>;
}

export const dataset: DatasetConfig = {
  id: "instacart",
  name: "Instacart Market Basket Analysis",
  description: "Grocery order behavior across orders, products, aisles, and departments.",
  unavailableConcepts: [
    "revenue",
    "sales",
    "price",
    "profit",
    "cost",
    "margin",
    "calendar dates",
    "months",
    "quarters",
    "years",
  ],
  tables: [
    {
      name: "departments",
      columns: [
        { name: "department_id", type: "int (PK)" },
        { name: "department_name", type: "text", note: "examples: produce, dairy eggs" },
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
        { name: "aisle_name", type: "text", note: "examples: fresh fruits, fresh herbs" },
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
        { name: "aisle_id", type: "int (FK to aisles.aisle_id)" },
        { name: "department_id", type: "int (FK to departments.department_id)" },
      ],
      sampleRows: [
        {
          product_id: 49633,
          product_name: "Organic Strawberries",
          aisle_id: 24,
          department_id: 3,
        },
      ],
    },
    {
      name: "orders",
      columns: [
        { name: "order_id", type: "int (PK)" },
        { name: "user_id", type: "int", note: "anonymous shopper id" },
        { name: "eval_set", type: "text", note: "prior or train" },
        { name: "order_number", type: "int", note: "order sequence for the shopper" },
        { name: "order_dow", type: "smallint", note: "0 Sunday through 6 Saturday" },
        { name: "order_hour_of_day", type: "smallint", note: "0 through 23" },
        { name: "days_since_prior_order", type: "numeric", note: "null for first order" },
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
      ],
    },
    {
      name: "order_items",
      columns: [
        { name: "order_id", type: "int (FK to orders.order_id)" },
        { name: "product_id", type: "int (FK to products.product_id)" },
        { name: "add_to_cart_order", type: "int" },
        { name: "reordered", type: "smallint", note: "1 if reordered, otherwise 0" },
      ],
      sampleRows: [
        { order_id: 2539329, product_id: 196, add_to_cart_order: 1, reordered: 0 },
      ],
    },
    {
      name: "summary_orders_by_dow",
      columns: [
        { name: "order_dow", type: "smallint (PK)" },
        { name: "day_name", type: "text" },
        { name: "order_count", type: "bigint" },
      ],
      sampleRows: [{ order_dow: 0, day_name: "Sunday", order_count: 610000 }],
    },
    {
      name: "summary_orders_by_hour",
      columns: [
        { name: "order_hour_of_day", type: "smallint (PK)" },
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
        { name: "reorder_rate", type: "numeric", note: "0 through 1" },
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
  ],
  glossary: `
Dataset: Instacart Market Basket Analysis.
There are no prices, revenue, profit, margin, or calendar order dates.

Preferred summary tables:
- orders by day of week: summary_orders_by_dow
- orders by hour: summary_orders_by_hour
- top departments by items ordered: summary_department_stats
- reorder rate by department: summary_department_stats
- top products: summary_product_stats

Business definitions:
- items_ordered = count of order_items rows.
- order_count = count of distinct orders.
- basket_size = items_ordered divided by order_count.
- reorder_rate = average reordered value across line items.
- day_name maps order_dow 0 to Sunday through 6 to Saturday.
- department attribution uses order_items to products to departments.
- aisle attribution uses order_items to products to aisles.
`.trim(),
  retrievalRules: [
    { pattern: "\\b(day|dow|weekday|weekend)\\b", tables: ["summary_orders_by_dow", "orders"] },
    { pattern: "\\b(hour|time|peak|morning|afternoon|evening)\\b", tables: ["summary_orders_by_hour", "orders"] },
    {
      pattern: "\\b(department|departments|category|categories|reorder|reordered|items ordered|volume)\\b",
      tables: ["summary_department_stats", "departments", "products", "order_items"],
    },
    {
      pattern: "\\b(product|products|aisle|aisles|top|ranking)\\b",
      tables: ["summary_product_stats", "products", "aisles", "departments", "order_items"],
    },
    { pattern: "\\b(order|orders|basket|cart|user|prior|train|eval|first)\\b", tables: ["orders", "order_items", "products"] },
  ],
  exampleQuestions: [
    { text: "Orders by day of week", tag: "Time" },
    { text: "Top 10 departments by items ordered", tag: "Rank" },
    { text: "Reorder rate by department", tag: "Rate" },
    { text: "Orders per hour of day", tag: "Pattern" },
    { text: "How are we doing?", tag: "Clarify" },
  ],
  evalCases: [
    {
      id: "orders_by_dow",
      question: "Orders by day of week",
      expectedTables: ["summary_orders_by_dow"],
      expectedChartType: "bar",
      shouldClarify: false,
    },
    {
      id: "top_departments",
      question: "Top 10 departments by items ordered",
      expectedTables: ["summary_department_stats"],
      expectedChartType: "bar",
      shouldClarify: false,
    },
    {
      id: "reorder_rate_department",
      question: "Reorder rate by department",
      expectedTables: ["summary_department_stats"],
      expectedChartType: "bar",
      shouldClarify: false,
    },
    {
      id: "orders_by_hour",
      question: "Orders per hour of day",
      expectedTables: ["summary_orders_by_hour"],
      expectedChartType: "line",
      shouldClarify: false,
    },
    {
      id: "vague_performance",
      question: "How are we doing?",
      expectedTables: [],
      shouldClarify: true,
    },
    {
      id: "unavailable_revenue",
      question: "Show revenue last quarter",
      expectedTables: [],
      shouldClarify: true,
    },
  ],
  demoRows: {
    summary_orders_by_dow: [
      { day_name: "Sunday", order_dow: 0, order_count: 620966 },
      { day_name: "Monday", order_dow: 1, order_count: 587478 },
      { day_name: "Tuesday", order_dow: 2, order_count: 467260 },
      { day_name: "Wednesday", order_dow: 3, order_count: 436972 },
      { day_name: "Thursday", order_dow: 4, order_count: 426339 },
      { day_name: "Friday", order_dow: 5, order_count: 453368 },
      { day_name: "Saturday", order_dow: 6, order_count: 448761 },
    ],
    summary_orders_by_hour: [
      { order_hour_of_day: 8, order_count: 178201 },
      { order_hour_of_day: 9, order_count: 257812 },
      { order_hour_of_day: 10, order_count: 288418 },
      { order_hour_of_day: 11, order_count: 284728 },
      { order_hour_of_day: 12, order_count: 272841 },
      { order_hour_of_day: 13, order_count: 277999 },
      { order_hour_of_day: 14, order_count: 283042 },
      { order_hour_of_day: 15, order_count: 283639 },
    ],
    summary_department_stats: [
      { department_name: "produce", department: "produce", items_ordered: 9479291, reorder_rate: 0.65 },
      { department_name: "dairy eggs", department: "dairy eggs", items_ordered: 5414016, reorder_rate: 0.67 },
      { department_name: "snacks", department: "snacks", items_ordered: 2887550, reorder_rate: 0.57 },
      { department_name: "beverages", department: "beverages", items_ordered: 2690129, reorder_rate: 0.6 },
      { department_name: "frozen", department: "frozen", items_ordered: 2236432, reorder_rate: 0.54 },
    ],
    summary_product_stats: [
      { product_name: "Banana", product: "Banana", department_name: "produce", items_ordered: 472565, reorder_rate: 0.85 },
      { product_name: "Bag of Organic Bananas", product: "Bag of Organic Bananas", department_name: "produce", items_ordered: 379450, reorder_rate: 0.83 },
      { product_name: "Organic Strawberries", product: "Organic Strawberries", department_name: "produce", items_ordered: 264683, reorder_rate: 0.7 },
      { product_name: "Organic Baby Spinach", product: "Organic Baby Spinach", department_name: "produce", items_ordered: 241921, reorder_rate: 0.76 },
      { product_name: "Organic Hass Avocado", product: "Organic Hass Avocado", department_name: "produce", items_ordered: 213584, reorder_rate: 0.74 },
    ],
  },
};

export const allowedTables = dataset.tables.map((table) => table.name);
