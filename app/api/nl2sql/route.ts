import { NextRequest, NextResponse } from "next/server";
import { Nl2SqlRequestSchema } from "@/lib/types";
import { generateSql } from "@/lib/anthropic";
import { getCached, setCached, stableCacheKey } from "@/lib/cache";
import { clarifyKnownLimitations } from "@/lib/intent";
import { logEvent, elapsedMs, nowMs, requestId } from "@/lib/logger";
import { guardSql } from "@/lib/sql-guard";
import { validateGeneratedQuery } from "@/lib/sql-validation";
import { getDatasetConfig } from "@/lib/uploaded-datasets";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const id = requestId();
  const started = nowMs();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent("warn", "nl2sql.invalid_json", { requestId: id });
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = Nl2SqlRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent("warn", "nl2sql.invalid_request", {
      requestId: id,
      issue: parsed.error.issues[0]?.message,
    });
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  try {
    const activeDataset = await getDatasetConfig(parsed.data.datasetId);
    const deterministicClarification = clarifyKnownLimitations(
      parsed.data.question,
      activeDataset
    );
    if (deterministicClarification) {
      const result = {
        sql: null,
        chart: null,
        explanation: "",
        needsClarification: true,
        clarificationQuestion: deterministicClarification,
        validationWarnings: [],
        schemaTables: [],
      };
      logEvent("info", "nl2sql.clarified_deterministic", {
        requestId: id,
        latencyMs: elapsedMs(started),
      });
      return NextResponse.json(result);
    }

    const cacheKey = stableCacheKey("nl2sql", parsed.data);
    const cached = getCached(cacheKey);
    if (cached) {
      logEvent("info", "nl2sql.cache_hit", {
        requestId: id,
        latencyMs: elapsedMs(started),
      });
      return NextResponse.json(cached);
    }

    const result = await generateSql(
      parsed.data.question,
      parsed.data.context ?? [],
      activeDataset
    );
    const warnings: string[] = [...(result.validationWarnings ?? [])];
    if (result.sql && result.chart) {
      const guard = guardSql(result.sql, activeDataset);
      if (!guard.ok) {
        logEvent("warn", "nl2sql.model_sql_rejected", {
          requestId: id,
          reason: guard.reason,
          latencyMs: elapsedMs(started),
        });
        return NextResponse.json(
          { error: `Generated SQL failed safety validation: ${guard.reason}` },
          { status: 502 }
        );
      }
      warnings.push(
        ...validateGeneratedQuery(
          parsed.data.question,
          guard.safeSql,
          result.chart,
          activeDataset
        ).warnings
      );
      result.sql = guard.safeSql;
    }
    const response = { ...result, validationWarnings: warnings };
    setCached(cacheKey, response, 10 * 60 * 1000);
    logEvent("info", "nl2sql.completed", {
      requestId: id,
      latencyMs: elapsedMs(started),
      needsClarification: response.needsClarification,
      schemaTables: response.schemaTables,
      warningCount: warnings.length,
    });
    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate SQL.";
    logEvent("error", "nl2sql.failed", {
      requestId: id,
      latencyMs: elapsedMs(started),
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
