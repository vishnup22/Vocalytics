import { createReadStream, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { buildSummaries } from "./build-summaries";

loadEnv({ path: ".env.local" });
loadEnv();

const DATA_DIR = join(process.cwd(), "backend", "data", "instacart");

const FILES = {
  departments: "departments.csv",
  aisles: "aisles.csv",
  products: "products.csv",
  orders: "orders.csv",
  prior: "order_products__prior.csv",
  train: "order_products__train.csv",
} as const;

type ItemsMode = "all" | "prior" | "train";

function parseArgs(): ItemsMode {
  const flag = process.argv.find((a) => a.startsWith("--items="));
  const val = flag?.split("=")[1] ?? "all";
  if (val === "prior" || val === "train" || val === "all") return val;
  console.error(`Unknown --items=${val}. Use all|prior|train.`);
  process.exit(1);
}

function requireFile(name: string): string {
  const path = join(DATA_DIR, name);
  if (!existsSync(path)) {
    console.error(`Missing: ${path}`);
    console.error("Download Instacart CSVs — see backend/data/instacart/README.md");
    process.exit(1);
  }
  return path;
}

async function copyCsv(
  client: Client,
  table: string,
  columns: string[],
  filePath: string
) {
  const cols = columns.join(", ");
  const ingest = (
    client as Client & {
      query: (q: ReturnType<typeof copyFrom>) => Writable;
    }
  ).query(
    copyFrom(
      `COPY ${table} (${cols}) FROM STDIN WITH (FORMAT csv, HEADER true, NULL '')`
    )
  );
  await pipeline(createReadStream(filePath), ingest);
}

async function main() {
  const itemsMode = parseArgs();
  const conn = process.env.SEED_DATABASE_URL || process.env.DATABASE_URL;
  if (!conn) {
    throw new Error("Set SEED_DATABASE_URL in .env.local");
  }

  const useSsl = !/@localhost|@127\.0\.0\.1/.test(conn);
  const client = new Client({
    connectionString: conn,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  console.log(`Connected. Items mode: ${itemsMode}`);

  const schemaSql = readFileSync(
    join(process.cwd(), "backend", "db", "schema.sql"),
    "utf8"
  );
  console.log("Applying schema…");
  await client.query(schemaSql);

  console.log("Loading departments…");
  await copyCsv(
    client,
    "departments",
    ["department_id", "department_name"],
    requireFile(FILES.departments)
  );

  console.log("Loading aisles…");
  await copyCsv(
    client,
    "aisles",
    ["aisle_id", "aisle_name"],
    requireFile(FILES.aisles)
  );

  console.log("Loading products…");
  await copyCsv(
    client,
    "products",
    ["product_id", "product_name", "aisle_id", "department_id"],
    requireFile(FILES.products)
  );

  console.log("Loading orders (~3.4M rows, may take several minutes)…");
  await copyCsv(
    client,
    "orders",
    [
      "order_id",
      "user_id",
      "eval_set",
      "order_number",
      "order_dow",
      "order_hour_of_day",
      "days_since_prior_order",
    ],
    requireFile(FILES.orders)
  );

  if (itemsMode === "all" || itemsMode === "prior") {
    console.log("Loading order_items (prior)…");
    await copyCsv(
      client,
      "order_items",
      ["order_id", "product_id", "add_to_cart_order", "reordered"],
      requireFile(FILES.prior)
    );
  }

  if (itemsMode === "all" || itemsMode === "train") {
    console.log("Loading order_items (train)…");
    await copyCsv(
      client,
      "order_items",
      ["order_id", "product_id", "add_to_cart_order", "reordered"],
      requireFile(FILES.train)
    );
  }

  const stats = await client.query(`
    SELECT
      (SELECT COUNT(*)::bigint FROM orders) AS orders,
      (SELECT COUNT(*)::bigint FROM order_items) AS order_items,
      (SELECT COUNT(*)::bigint FROM products) AS products
  `);
  const s = stats.rows[0];
  console.log("\nImport complete:");
  console.log(`  orders:       ${s.orders}`);
  console.log(`  order_items:  ${s.order_items}`);
  console.log(`  products:     ${s.products}`);

  await buildSummaries(client);

  const sample = await client.query(`
    SELECT department_name, items_ordered
    FROM summary_department_stats
    ORDER BY items_ordered DESC
    LIMIT 5
  `);
  console.log("\nTop departments by items ordered (from summaries):");
  for (const row of sample.rows) {
    console.log(`  ${row.department_name}: ${row.items_ordered}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
