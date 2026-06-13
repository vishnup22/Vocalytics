import { NextRequest, NextResponse } from "next/server";
import { listDatasets, saveUploadedDataset } from "@/lib/uploaded-datasets";
import { logEvent, elapsedMs, nowMs, requestId } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  return NextResponse.json({ datasets: await listDatasets() });
}

export async function POST(req: NextRequest) {
  const id = requestId();
  const started = nowMs();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Only CSV uploads are supported." }, { status: 400 });
  }

  try {
    const dataset = await saveUploadedDataset({
      filename: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    logEvent("info", "dataset.uploaded", {
      requestId: id,
      latencyMs: elapsedMs(started),
      datasetId: dataset.id,
      rowCount: dataset.rowCount,
    });
    return NextResponse.json({ dataset });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dataset upload failed.";
    logEvent("error", "dataset.upload_failed", {
      requestId: id,
      latencyMs: elapsedMs(started),
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
