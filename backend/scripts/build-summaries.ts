import { config as loadEnv } from "dotenv";
import type { Client } from "pg";
import { Client as PgClient } from "pg";

loadEnv({ path: ".env.local" });
loadEnv();

export async function buildSummaries(client: Client) {
  console.log("Building summary tables (one aggregation at a time)…");

  await client.query("TRUNCATE summary_orders_by_dow");
  console.log("  summary_orders_by_dow…");
  await client.query(`
    INSERT INTO summary_orders_by_dow (order_dow, day_name, order_count)
    SELECT order_dow,
           CASE order_dow
             WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
             WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
             WHEN 6 THEN 'Saturday'
           END,
           COUNT(*)::bigint
    FROM orders
    GROUP BY order_dow
  `);

  await client.query("TRUNCATE summary_orders_by_hour");
  console.log("  summary_orders_by_hour…");
  await client.query(`
    INSERT INTO summary_orders_by_hour (order_hour_of_day, order_count)
    SELECT order_hour_of_day, COUNT(*)::bigint
    FROM orders
    GROUP BY order_hour_of_day
  `);

  const itemCount = await client.query<{ n: string }>(
    "SELECT COUNT(*)::bigint AS n FROM order_items"
  );
  const n = Number(itemCount.rows[0]?.n ?? 0);
  if (n === 0) {
    console.log("  (skipping department/product summaries — no order_items)");
    return;
  }

  await client.query("TRUNCATE summary_department_stats");
  console.log("  summary_department_stats… (may take a few minutes)");
  await client.query(`
    INSERT INTO summary_department_stats (
      department_id, department_name, items_ordered, reorder_rate
    )
    SELECT d.department_id,
           d.department_name,
           COUNT(*)::bigint,
           ROUND(AVG(oi.reordered::numeric), 4)
    FROM order_items oi
    JOIN products p ON p.product_id = oi.product_id
    JOIN departments d ON d.department_id = p.department_id
    GROUP BY d.department_id, d.department_name
  `);

  await client.query("TRUNCATE summary_product_stats");
  console.log("  summary_product_stats…");
  await client.query(`
    INSERT INTO summary_product_stats (
      product_id, product_name, department_name, items_ordered, reorder_rate
    )
    SELECT p.product_id,
           p.product_name,
           d.department_name,
           COUNT(*)::bigint,
           ROUND(AVG(oi.reordered::numeric), 4)
    FROM order_items oi
    JOIN products p ON p.product_id = oi.product_id
    JOIN departments d ON d.department_id = p.department_id
    GROUP BY p.product_id, p.product_name, d.department_name
  `);
}

async function main() {
  const conn = process.env.SEED_DATABASE_URL || process.env.DATABASE_URL;
  if (!conn) throw new Error("Set SEED_DATABASE_URL in .env.local");

  const useSsl = !/@localhost|@127\.0\.0\.1/.test(conn);
  const client = new PgClient({
    connectionString: conn,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  await buildSummaries(client);

  const check = await client.query(`
    SELECT 'orders_by_dow' AS tbl, COUNT(*)::int AS rows FROM summary_orders_by_dow
    UNION ALL SELECT 'orders_by_hour', COUNT(*) FROM summary_orders_by_hour
    UNION ALL SELECT 'department_stats', COUNT(*) FROM summary_department_stats
    UNION ALL SELECT 'product_stats', COUNT(*) FROM summary_product_stats
  `);
  console.log("\nSummary row counts:");
  for (const row of check.rows) {
    console.log(`  ${row.tbl}: ${row.rows}`);
  }

  await client.end();
  console.log("\nDone. Re-ask your question in the app.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
