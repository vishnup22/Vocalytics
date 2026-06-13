import type { ReadOnlyResult } from "@/lib/db";

interface SelectExpr {
  source: string;
  alias: string;
  kind: "column" | "count" | "sum" | "avg" | "min" | "max";
  column?: string;
}

export function runUploadedQuery(
  sql: string,
  rows: Record<string, unknown>[]
): ReadOnlyResult {
  const normalized = sql.replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /^select\s+(.+?)\s+from\s+"?uploaded_rows"?(?:\s+group\s+by\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?)?(?:\s+order\s+by\s+"?([a-zA-Z_][a-zA-Z0-9_]*|\d+)"?(?:\s+(asc|desc))?)?(?:\s+limit\s+(\d+))?$/i
  );
  if (!match) {
    throw new Error("Uploaded datasets support SELECT, GROUP BY, ORDER BY, and LIMIT over uploaded_rows.");
  }

  const expressions = parseSelect(match[1]);
  const groupBy = match[2];
  const orderBy = match[3];
  const orderDir = (match[4] ?? "asc").toLowerCase();
  const limit = Math.min(Number(match[5] ?? 1000), 1000);

  const resultRows = groupBy
    ? groupedRows(rows, groupBy, expressions)
    : plainRows(rows, expressions);

  if (orderBy) {
    const key = /^\d+$/.test(orderBy)
      ? Object.keys(resultRows[0] ?? {})[Number(orderBy) - 1]
      : orderBy;
    resultRows.sort((a, b) => compareValues(a[key], b[key], orderDir));
  }

  const limited = resultRows.slice(0, limit);
  return {
    columns: Object.keys(limited[0] ?? resultRows[0] ?? {}),
    rows: limited,
    rowCount: limited.length,
  };
}

function parseSelect(selectSql: string): SelectExpr[] {
  return splitComma(selectSql).map((source) => {
    const trimmed = source.trim();
    const aliasMatch = trimmed.match(/\s+as\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?$/i);
    const withoutAlias = aliasMatch
      ? trimmed.slice(0, aliasMatch.index).trim()
      : trimmed;
    const aggregate = withoutAlias.match(/^(count|sum|avg|min|max)\s*\(\s*(\*|[a-zA-Z_][a-zA-Z0-9_]*)\s*\)$/i);
    if (aggregate) {
      const kind = aggregate[1].toLowerCase() as SelectExpr["kind"];
      const column = aggregate[2] === "*" ? undefined : aggregate[2];
      return {
        source: trimmed,
        alias: aliasMatch?.[1] ?? (kind === "count" ? "count" : `${kind}_${column}`),
        kind,
        column,
      };
    }
    const column = withoutAlias.replace(/^"|"$/g, "");
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Unsupported select expression: ${trimmed}`);
    }
    return {
      source: trimmed,
      alias: aliasMatch?.[1] ?? column,
      kind: "column",
      column,
    };
  });
}

function plainRows(rows: Record<string, unknown>[], expressions: SelectExpr[]) {
  const hasAggregate = expressions.some((expr) => expr.kind !== "column");
  if (hasAggregate) {
    const out: Record<string, unknown> = {};
    for (const expr of expressions) out[expr.alias] = aggregate(rows, expr);
    return [out];
  }
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const expr of expressions) out[expr.alias] = row[expr.column ?? ""];
    return out;
  });
}

function groupedRows(
  rows: Record<string, unknown>[],
  groupBy: string,
  expressions: SelectExpr[]
) {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = String(row[groupBy] ?? "");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups.entries()).map(([key, groupRows]) => {
    const out: Record<string, unknown> = {};
    for (const expr of expressions) {
      if (expr.kind === "column") {
        out[expr.alias] = expr.column === groupBy ? key : groupRows[0]?.[expr.column ?? ""];
      } else {
        out[expr.alias] = aggregate(groupRows, expr);
      }
    }
    return out;
  });
}

function aggregate(rows: Record<string, unknown>[], expr: SelectExpr): unknown {
  if (expr.kind === "count") return rows.length;
  const values = rows
    .map((row) => Number(row[expr.column ?? ""]))
    .filter((value) => !Number.isNaN(value));
  if (expr.kind === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (expr.kind === "avg") {
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }
  if (expr.kind === "min") return values.length ? Math.min(...values) : null;
  if (expr.kind === "max") return values.length ? Math.max(...values) : null;
  return null;
}

function splitComma(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function compareValues(a: unknown, b: unknown, dir: string): number {
  const mult = dir === "desc" ? -1 : 1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * mult;
  return String(a ?? "").localeCompare(String(b ?? "")) * mult;
}
