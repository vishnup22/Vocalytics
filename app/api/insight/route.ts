import { NextRequest, NextResponse } from "next/server";
import { InsightRequestSchema } from "@/lib/types";
import { generateInsight } from "@/lib/insights";
import { getCached, setCached, stableCacheKey } from "@/lib/cache";
import { logEvent, elapsedMs, nowMs, requestId } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const id = requestId();
  const started = nowMs();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = InsightRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  try {
    const cacheKey = stableCacheKey("insight", {
      question: parsed.data.question,
      sql: parsed.data.sql,
      rows: parsed.data.rows.slice(0, 50),
    });
    const cached = getCached<{ insight: string }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
    const insight = await generateInsight(parsed.data);
    const response = { insight };
    setCached(cacheKey, response, 10 * 60 * 1000);
    logEvent("info", "insight.completed", {
      requestId: id,
      latencyMs: elapsedMs(started),
      rowCount: parsed.data.rows.length,
    });
    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate insight.";
    logEvent("error", "insight.failed", {
      requestId: id,
      latencyMs: elapsedMs(started),
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
