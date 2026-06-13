import { describe, it, expect } from "vitest";
import { guardSql } from "./sql-guard";

describe("guardSql — accepts valid SELECTs", () => {
  it("allows summary rollup tables", () => {
    const r = guardSql(
      "SELECT day_name, order_count FROM summary_orders_by_dow ORDER BY order_dow"
    );
    expect(r.ok).toBe(true);
  });

  it("passes a simple SELECT and injects a LIMIT", () => {
    const r = guardSql("SELECT product_name FROM products");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.safeSql.toUpperCase()).toContain("LIMIT 1000");
  });

  it("keeps a join across allowed tables", () => {
    const r = guardSql(
      "SELECT d.department_name, COUNT(*) FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id JOIN departments d ON d.department_id = p.department_id GROUP BY d.department_name"
    );
    expect(r.ok).toBe(true);
  });

  it("does not flag column names containing denylist substrings", () => {
    const r = guardSql("SELECT add_to_cart_order FROM order_items");
    expect(r.ok).toBe(true);
  });

  it("clamps an oversized LIMIT to 5000", () => {
    const r = guardSql("SELECT id FROM orders LIMIT 999999");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.safeSql).toMatch(/LIMIT 5000/i);
      expect(r.safeSql).not.toMatch(/999999/);
    }
  });

  it("preserves a small explicit LIMIT", () => {
    const r = guardSql("SELECT id FROM orders LIMIT 10");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.safeSql).toMatch(/LIMIT 10/i);
  });
});

describe("guardSql — rejects dangerous input (one per rule)", () => {
  it("rejects unparseable SQL", () => {
    expect(guardSql("SELECT FROM WHERE").ok).toBe(false);
  });

  it("rejects multiple statements", () => {
    const r = guardSql("SELECT 1 FROM orders; SELECT 2 FROM orders");
    expect(r.ok).toBe(false);
  });

  it("rejects non-SELECT (DELETE)", () => {
    expect(guardSql("DELETE FROM orders").ok).toBe(false);
  });

  it("rejects DROP TABLE", () => {
    expect(guardSql("DROP TABLE orders").ok).toBe(false);
  });

  it("rejects INSERT", () => {
    expect(guardSql("INSERT INTO orders (id) VALUES (1)").ok).toBe(false);
  });

  it("rejects UPDATE", () => {
    expect(guardSql("UPDATE orders SET status = 'x'").ok).toBe(false);
  });

  it("rejects a stacked DROP after a SELECT", () => {
    const r = guardSql("SELECT * FROM orders; DROP TABLE orders");
    expect(r.ok).toBe(false);
  });

  it("rejects access to a table outside the allowlist", () => {
    const r = guardSql("SELECT * FROM secrets");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain("not allowed");
  });

  it("rejects pg_ catalog access", () => {
    expect(guardSql("SELECT * FROM pg_user").ok).toBe(false);
  });

  it("rejects information_schema access", () => {
    expect(guardSql("SELECT * FROM information_schema.tables").ok).toBe(false);
  });

  it("rejects empty input", () => {
    expect(guardSql("   ").ok).toBe(false);
  });

  it("rejects SELECT star", () => {
    expect(guardSql("SELECT * FROM orders").ok).toBe(false);
  });

  it("rejects cross joins", () => {
    expect(
      guardSql("SELECT o.order_id FROM orders o CROSS JOIN products p LIMIT 10").ok
    ).toBe(false);
  });

  it("rejects unknown functions", () => {
    expect(guardSql("SELECT pg_sleep(1) FROM orders").ok).toBe(false);
  });
});
