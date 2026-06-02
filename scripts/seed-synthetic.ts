import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: ".env.local" });
loadEnv();

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20240517);
const randInt = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const START = new Date(Date.UTC(2023, 0, 1));
const END = new Date(Date.UTC(2024, 11, 31));
const DAY_MS = 24 * 60 * 60 * 1000;
const TOTAL_DAYS = Math.round((END.getTime() - START.getTime()) / DAY_MS);

function randomDate(): Date {
  return new Date(START.getTime() + randInt(0, TOTAL_DAYS) * DAY_MS);
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function isLatestQ3(d: Date): boolean {
  const m = d.getUTCMonth();
  return d.getUTCFullYear() === 2024 && m >= 6 && m <= 8;
}

const REGIONS = [
  { id: 1, continent: "Europe" },
  { id: 2, continent: "Europe" },
  { id: 3, continent: "Europe" },
  { id: 4, continent: "Europe" },
  { id: 5, continent: "North America" },
  { id: 6, continent: "North America" },
];
const CATEGORY_IDS = [1, 2, 3, 4, 5, 6];
const PRODUCT_WORDS: Record<number, string[]> = {
  1: ["Aero Headphones", "Nimbus Laptop", "Pulse Earbuds", "Volt Charger", "Quartz Monitor", "Echo Speaker", "Flux Tablet"],
  2: ["Drift Jacket", "Summit Hoodie", "Crest Tee", "Trail Pants", "Harbor Cap", "Lumen Sneakers"],
  3: ["Brew Kettle", "Ember Skillet", "Cloud Duvet", "Slate Knife Set", "Terra Planter", "Maple Board"],
  4: ["Ridge Tent", "Bolt Bottle", "Glide Skates", "Apex Backpack", "Trek Poles", "Surge Ball"],
  5: ["Glow Serum", "Velvet Balm", "Aura Mist", "Petal Mask", "Bloom Oil"],
  6: ["Cosmo Blocks", "Pixel Puzzle", "Rover Drone", "Saga Cards", "Tilt Maze"],
};

interface Product { id: number; categoryId: number; price: number; cost: number; }
interface Customer { id: number; regionId: number; continent: string; }

async function main() {
  const conn = process.env.SEED_DATABASE_URL || process.env.DATABASE_URL;
  if (!conn) {
    throw new Error(
      "Set SEED_DATABASE_URL (preferred, owner role) or DATABASE_URL in .env.local"
    );
  }
  const useSsl = !/@localhost|@127\.0\.0\.1/.test(conn);
  const client = new Client({
    connectionString: conn,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  console.log("Connected. Building schema + reference data...");

  const schemaSql = readFileSync(join(process.cwd(), "db", "schema-synthetic.sql"), "utf8");
  const seedSql = readFileSync(join(process.cwd(), "db", "seed.sql"), "utf8");
  await client.query(schemaSql);
  await client.query(seedSql);

  const products: Product[] = [];
  let pid = 1;
  for (const categoryId of CATEGORY_IDS) {
    const names = PRODUCT_WORDS[categoryId];
    for (const name of names) {
      const price = Number((randInt(1500, 40000) / 100).toFixed(2));
      const cost = Number((price * (0.45 + rand() * 0.3)).toFixed(2));
      products.push({ id: pid, categoryId, price, cost });
      await client.query(
        "INSERT INTO products (id, name, category_id, price, cost) VALUES ($1,$2,$3,$4,$5)",
        [pid, name, categoryId, price, cost]
      );
      pid++;
    }
  }
  await client.query("SELECT setval('products_id_seq', (SELECT MAX(id) FROM products))");
  console.log(`Inserted ${products.length} products.`);

  const FIRST = ["Alex","Sam","Jordan","Maria","Liam","Noah","Emma","Olivia","Lucas","Mia","Hugo","Lena","Sofia","Marc","Ivy","Theo","Nora","Finn","Aria","Leo"];
  const LAST = ["Becker","Dubois","Smith","Garcia","Rossi","Novak","Khan","Müller","Brown","Silva","Lopez","Wang","Costa","Meyer","Patel","Kim","Jensen","Roy","Haas","Ford"];
  const customers: Customer[] = [];
  const CUSTOMER_COUNT = 500;
  const values: string[] = [];
  const params: unknown[] = [];
  for (let i = 1; i <= CUSTOMER_COUNT; i++) {
    const region = pick(REGIONS);
    customers.push({ id: i, regionId: region.id, continent: region.continent });
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const createdAt = ymd(randomDate());
    const base = (i - 1) * 4;
    values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4})`);
    params.push(i, name, region.id, createdAt);
  }
  await client.query(
    `INSERT INTO customers (id, name, region_id, created_at) VALUES ${values.join(",")}`,
    params
  );
  await client.query("SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers))");
  console.log(`Inserted ${customers.length} customers.`);

  interface Order { id: number; customerId: number; date: string; status: string; }
  const orders: Order[] = [];
  let oid = 1;
  const CANDIDATES = 5600;

  for (let c = 0; c < CANDIDATES; c++) {
    const customer = pick(customers);
    const date = randomDate();
    const europeanDip = customer.continent === "Europe" && isLatestQ3(date);

    if (europeanDip && rand() < 0.5) continue;

    let status = "completed";
    const roll = rand();
    if (europeanDip) {
      if (roll < 0.3) status = "refunded";
      else if (roll < 0.4) status = "cancelled";
    } else {
      if (roll < 0.08) status = "refunded";
      else if (roll < 0.13) status = "cancelled";
    }
    orders.push({ id: oid, customerId: customer.id, date: ymd(date), status });
    oid++;
  }

  await batchInsert(
    client,
    "orders",
    ["id", "customer_id", "order_date", "status"],
    orders.map((o) => [o.id, o.customerId, o.date, o.status])
  );
  console.log(`Inserted ${orders.length} orders.`);

  const itemRows: unknown[][] = [];
  let itemId = 1;
  for (const order of orders) {
    const lineCount = randInt(1, 4);
    const used = new Set<number>();
    for (let l = 0; l < lineCount; l++) {
      const product = pick(products);
      if (used.has(product.id)) continue;
      used.add(product.id);
      const quantity = randInt(1, 5);
      const unitPrice = Number((product.price * (0.9 + rand() * 0.15)).toFixed(2));
      itemRows.push([itemId, order.id, product.id, quantity, unitPrice]);
      itemId++;
    }
  }
  await batchInsert(
    client,
    "order_items",
    ["id", "order_id", "product_id", "quantity", "unit_price"],
    itemRows
  );
  console.log(`Inserted ${itemRows.length} order items.`);

  await client.query("SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders))");
  await client.query("SELECT setval('order_items_id_seq', (SELECT MAX(id) FROM order_items))");

  const check = await client.query(`
    SELECT date_trunc('quarter', o.order_date)::date AS quarter,
           ROUND(SUM(oi.quantity * oi.unit_price)) AS revenue
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN customers c ON c.id = o.customer_id
    JOIN regions r ON r.id = c.region_id
    WHERE r.continent = 'Europe' AND o.status = 'completed'
      AND o.order_date >= '2024-01-01'
    GROUP BY 1 ORDER BY 1
  `);
  console.log("\nEurope completed revenue by quarter (2024):");
  for (const row of check.rows) {
    console.log(`  ${row.quarter}  ${row.revenue}`);
  }

  await client.end();
  console.log("\nSeed complete.");
}

async function batchInsert(
  client: Client,
  table: string,
  columns: string[],
  rows: unknown[][],
  chunkSize = 500
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params: unknown[] = [];
    const tuples = chunk.map((row, r) => {
      const placeholders = row.map((_, c) => `$${r * columns.length + c + 1}`);
      params.push(...row);
      return `(${placeholders.join(",")})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${tuples.join(",")}`,
      params
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
