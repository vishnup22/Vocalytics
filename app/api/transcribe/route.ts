import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/stt";
import { logEvent, elapsedMs, nowMs, requestId } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const id = requestId();
  const started = nowMs();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "No audio provided in field 'audio'." },
      { status: 400 }
    );
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    logEvent("warn", "transcribe.audio_too_large", {
      requestId: id,
      bytes: audio.size,
    });
    return NextResponse.json(
      { error: "Audio is too large. Keep recordings short and try again." },
      { status: 413 }
    );
  }

  try {
    const text = await transcribeAudio(audio);
    logEvent("info", "transcribe.completed", {
      requestId: id,
      latencyMs: elapsedMs(started),
      bytes: audio.size,
      provider: process.env.STT_PROVIDER ?? "openai",
    });
    return NextResponse.json({ text });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Speech-to-text provider failed.";
    logEvent("error", "transcribe.failed", {
      requestId: id,
      latencyMs: elapsedMs(started),
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
