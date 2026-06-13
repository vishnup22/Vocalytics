import type { ReadOnlyResult } from "@/lib/db";
import { dataset } from "@/lib/dataset";

export function demoResultForSql(sql: string): ReadOnlyResult | null {
  const lower = sql.toLowerCase();
  for (const [table, rows] of Object.entries(dataset.demoRows)) {
    if (lower.includes(table.toLowerCase())) {
      return toResult(rows);
    }
  }
  return null;
}

function toResult(rows: Record<string, unknown>[]): ReadOnlyResult {
  return {
    columns: Object.keys(rows[0] ?? {}),
    rows,
    rowCount: rows.length,
  };
}
