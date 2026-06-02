import { Parser } from "node-sql-parser";

const PARSER_OPT = { database: "PostgresQL" } as const;

export const ALLOWED_TABLES = [
  "departments",
  "aisles",
  "products",
  "orders",
  "order_items",
  "summary_orders_by_dow",
  "summary_orders_by_hour",
  "summary_department_stats",
  "summary_product_stats",
] as const;

const ALLOWED_TABLE_SET = new Set<string>(ALLOWED_TABLES);

const DENY_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "truncate",
  "grant",
  "revoke",
  "copy",
  "merge",
];

const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 1000;

export type GuardResult =
  | { ok: true; safeSql: string }
  | { ok: false; reason: string };

const parser = new Parser();

export function guardSql(input: string): GuardResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "Empty SQL." };

  const withoutTrailingSemicolon = raw.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    return { ok: false, reason: "Multiple statements are not allowed." };
  }

  for (const kw of DENY_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(withoutTrailingSemicolon)) {
      return { ok: false, reason: `Disallowed keyword: ${kw.toUpperCase()}.` };
    }
  }
  if (/\bpg_/i.test(withoutTrailingSemicolon)) {
    return { ok: false, reason: "Access to pg_* objects is not allowed." };
  }
  if (/information_schema/i.test(withoutTrailingSemicolon)) {
    return { ok: false, reason: "Access to information_schema is not allowed." };
  }

  let ast: unknown;
  try {
    ast = parser.astify(withoutTrailingSemicolon, PARSER_OPT);
  } catch {
    return { ok: false, reason: "Could not parse SQL." };
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1) {
    return { ok: false, reason: "Exactly one statement is required." };
  }
  const stmt = statements[0] as { type?: string; limit?: unknown };

  if (stmt.type !== "select") {
    return { ok: false, reason: "Only SELECT statements are allowed." };
  }

  let tableList: string[];
  try {
    tableList = parser.tableList(withoutTrailingSemicolon, PARSER_OPT);
  } catch {
    return { ok: false, reason: "Could not analyze tables." };
  }
  for (const entry of tableList) {
    const parts = entry.split("::");
    const table = parts[parts.length - 1];
    if (table === "null") continue;
    if (!ALLOWED_TABLE_SET.has(table)) {
      return { ok: false, reason: `Table not allowed: ${table}.` };
    }
  }

  const limitNode = stmt.limit as
    | { seperator?: string; value?: { type: string; value: number }[] }
    | null
    | undefined;

  const hasLimit =
    !!limitNode && Array.isArray(limitNode.value) && limitNode.value.length > 0;

  if (!hasLimit) {
    (stmt as { limit: unknown }).limit = {
      seperator: "",
      value: [{ type: "number", value: DEFAULT_LIMIT }],
    };
  } else {
    const first = limitNode!.value![0];
    if (first && first.type === "number" && first.value > MAX_LIMIT) {
      first.value = MAX_LIMIT;
    }
  }

  let safeSql: string;
  try {
    safeSql = parser.sqlify(
      stmt as unknown as Parameters<typeof parser.sqlify>[0],
      PARSER_OPT
    );
  } catch {
    return { ok: false, reason: "Could not finalize SQL." };
  }

  return { ok: true, safeSql };
}
