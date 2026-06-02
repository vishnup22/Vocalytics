import { NextRequest, NextResponse } from "next/server";
import { QueryRequestSchema } from "@/lib/types";
import { guardSql } from "@/lib/sql-guard";
import { runReadOnly } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = QueryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const guard = guardSql(parsed.data.sql);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: 400 });
  }

  try {
    const result = await runReadOnly(guard.safeSql);
    return NextResponse.json({
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Query execution failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
