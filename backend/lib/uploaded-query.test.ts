import { describe, expect, it } from "vitest";
import { runUploadedQuery } from "./uploaded-query";

const rows = [
  { region: "East", sales: 10, units: 2 },
  { region: "East", sales: 20, units: 3 },
  { region: "West", sales: 7, units: 1 },
];

describe("runUploadedQuery", () => {
  it("groups rows and applies aggregate aliases", () => {
    const result = runUploadedQuery(
      "SELECT region, SUM(sales) AS total_sales, COUNT(*) AS orders FROM uploaded_rows GROUP BY region ORDER BY total_sales DESC LIMIT 10",
      rows
    );
    expect(result.columns).toEqual(["region", "total_sales", "orders"]);
    expect(result.rows).toEqual([
      { region: "East", total_sales: 30, orders: 2 },
      { region: "West", total_sales: 7, orders: 1 },
    ]);
  });

  it("projects selected columns", () => {
    const result = runUploadedQuery(
      "SELECT region, sales FROM uploaded_rows ORDER BY sales DESC LIMIT 2",
      rows
    );
    expect(result.rows).toEqual([
      { region: "East", sales: 20 },
      { region: "East", sales: 10 },
    ]);
  });
});
