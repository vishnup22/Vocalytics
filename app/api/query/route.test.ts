import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const runReadOnly = vi.fn();
const explainReadOnly = vi.fn();
vi.mock("@/lib/db", () => ({
  explainReadOnly: (sql: string) => explainReadOnly(sql),
  runReadOnly: (sql: string) => runReadOnly(sql),
}));

import { POST } from "./route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/query", () => {
  beforeEach(() => {
    runReadOnly.mockReset();
    explainReadOnly.mockReset();
    explainReadOnly.mockResolvedValue(100);
  });

  it("executes a valid SELECT and returns columns/rows", async () => {
    runReadOnly.mockResolvedValue({
      columns: ["revenue"],
      rows: [{ revenue: 12345 }],
      rowCount: 1,
    });

    const res = await POST(makeRequest({ sql: "SELECT 1 AS revenue FROM orders" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      columns: ["revenue"],
      rows: [{ revenue: 12345 }],
      rowCount: 1,
      cacheHit: false,
    });
    expect(typeof json.latencyMs).toBe("number");
    expect(runReadOnly).toHaveBeenCalledTimes(1);
    expect(explainReadOnly).toHaveBeenCalledTimes(1);
    expect(String(runReadOnly.mock.calls[0][0]).toUpperCase()).toContain("LIMIT");
  });

  it("rejects a destructive statement with 400 and never hits the DB", async () => {
    const res = await POST(makeRequest({ sql: "DROP TABLE orders" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(runReadOnly).not.toHaveBeenCalled();
    expect(explainReadOnly).not.toHaveBeenCalled();
  });

  it("rejects a table outside the allowlist with 400", async () => {
    const res = await POST(makeRequest({ sql: "SELECT * FROM secrets" }));
    expect(res.status).toBe(400);
    expect(runReadOnly).not.toHaveBeenCalled();
    expect(explainReadOnly).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid request body", async () => {
    const res = await POST(makeRequest({ notSql: true }));
    expect(res.status).toBe(400);
    expect(runReadOnly).not.toHaveBeenCalled();
    expect(explainReadOnly).not.toHaveBeenCalled();
  });

  it("surfaces a DB execution failure as 500", async () => {
    const oldFallback = process.env.DEMO_FALLBACK;
    process.env.DEMO_FALLBACK = "false";
    runReadOnly.mockRejectedValue(new Error("statement timeout"));
    const res = await POST(makeRequest({ sql: "SELECT id FROM orders" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("statement timeout");
    process.env.DEMO_FALLBACK = oldFallback;
  });

  it("returns bundled demo rows when the database host is unavailable", async () => {
    runReadOnly.mockRejectedValue(new Error("getaddrinfo ENOTFOUND db.example"));
    const res = await POST(
      makeRequest({
        sql: "SELECT day_name, order_count FROM summary_orders_by_dow ORDER BY order_dow",
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.demo).toBe(true);
    expect(json.rows.length).toBeGreaterThan(0);
  });

  it("rejects queries above the configured cost before execution", async () => {
    explainReadOnly.mockResolvedValue(999999999);
    const res = await POST(makeRequest({ sql: "SELECT id FROM orders" }));
    expect(res.status).toBe(400);
    expect(runReadOnly).not.toHaveBeenCalled();
  });
});
