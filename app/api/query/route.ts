import { NextRequest, NextResponse } from "next/server";
import { QueryRequestSchema } from "@/lib/types";
import { guardSql } from "@/lib/sql-guard";
import { explainReadOnly, runReadOnly } from "@/lib/db";
import { getCached, setCached, stableCacheKey } from "@/lib/cache";
import { logEvent, elapsedMs, nowMs, requestId } from "@/lib/logger";
import { demoResultForSql } from "@/lib/demo-data";
import { getDatasetConfig, getUploadedRows } from "@/lib/uploaded-datasets";
import { runUploadedQuery } from "@/lib/uploaded-query";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const id = requestId();
  const started = nowMs();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent("warn", "query.invalid_json", { requestId: id });
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = QueryRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent("warn", "query.invalid_request", {
      requestId: id,
      issue: parsed.error.issues[0]?.message,
    });
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  let safeSqlForFallback = parsed.data.sql;
  let guardTables: string[] = [];
  let datasetName = "dataset";

  try {
    const activeDataset = await getDatasetConfig(parsed.data.datasetId);
    datasetName = activeDataset.name;
    const uploadedRows = await getUploadedRows(parsed.data.datasetId);
    const guard = guardSql(parsed.data.sql, activeDataset);
    if (!guard.ok) {
      logEvent("warn", "query.rejected", {
        requestId: id,
        reason: guard.reason,
        latencyMs: elapsedMs(started),
      });
      return NextResponse.json({ error: guard.reason }, { status: 400 });
    }
    safeSqlForFallback = guard.safeSql;
    guardTables = guard.tables;

    if (uploadedRows) {
      const result = runUploadedQuery(guard.safeSql, uploadedRows);
      logEvent("info", "query.uploaded_completed", {
        requestId: id,
        latencyMs: elapsedMs(started),
        rowCount: result.rowCount,
        datasetId: parsed.data.datasetId,
      });
      return NextResponse.json({
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        cacheHit: false,
        latencyMs: elapsedMs(started),
      });
    }

    if (process.env.DEMO_MODE === "true") {
      const demo = demoResultForSql(guard.safeSql);
      if (demo) {
        logEvent("info", "query.demo_mode", {
          requestId: id,
          latencyMs: elapsedMs(started),
          tables: guard.tables,
        });
        return NextResponse.json({
          columns: demo.columns,
          rows: demo.rows,
          rowCount: demo.rowCount,
          cacheHit: false,
          latencyMs: elapsedMs(started),
          demo: true,
          warning: `Showing sample ${activeDataset.name} results.`,
        });
      }
    }

    const cacheKey = stableCacheKey("query", {
      datasetId: parsed.data.datasetId ?? activeDataset.id,
      sql: guard.safeSql,
    });
    const cached = getCached<{
      columns: string[];
      rows: Record<string, unknown>[];
      rowCount: number;
    }>(cacheKey);
    if (cached) {
      logEvent("info", "query.cache_hit", {
        requestId: id,
        tables: guard.tables,
        latencyMs: elapsedMs(started),
      });
      return NextResponse.json({
        ...cached,
        cacheHit: true,
        latencyMs: elapsedMs(started),
      });
    }

    const maxCost = Number(process.env.MAX_QUERY_COST ?? 250000);
    const estimatedCost = await explainReadOnly(guard.safeSql);
    if (estimatedCost !== null && estimatedCost > maxCost) {
      logEvent("warn", "query.cost_rejected", {
        requestId: id,
        estimatedCost,
        maxCost,
        tables: guard.tables,
      });
      return NextResponse.json(
        { error: `Query plan cost ${estimatedCost} exceeds limit ${maxCost}.` },
        { status: 400 }
      );
    }

    const result = await runReadOnly(guard.safeSql);
    const response = {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
    };
    setCached(cacheKey, response, 5 * 60 * 1000);
    logEvent("info", "query.completed", {
      requestId: id,
      latencyMs: elapsedMs(started),
      rowCount: result.rowCount,
      tables: guard.tables,
      joins: guard.complexity.joins,
      estimatedCost,
    });
    return NextResponse.json({
      ...response,
      cacheHit: false,
      latencyMs: elapsedMs(started),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Query execution failed.";
    const demoFallbackEnabled = process.env.DEMO_FALLBACK !== "false";
    const connectionFailure =
      /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|getaddrinfo|DATABASE_URL is not set/i.test(
        message
      );
    const demo = demoFallbackEnabled && connectionFailure
      ? demoResultForSql(safeSqlForFallback)
      : null;
    if (demo) {
      logEvent("warn", "query.demo_fallback", {
        requestId: id,
        latencyMs: elapsedMs(started),
        error: message,
        tables: guardTables,
      });
      return NextResponse.json({
        columns: demo.columns,
        rows: demo.rows,
        rowCount: demo.rowCount,
        cacheHit: false,
        latencyMs: elapsedMs(started),
        demo: true,
        warning: `Showing sample ${datasetName} results while the database is unavailable.`,
      });
    }
    logEvent("error", "query.failed", {
      requestId: id,
      latencyMs: elapsedMs(started),
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
