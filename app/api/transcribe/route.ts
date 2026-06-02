import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/stt";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
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

  try {
    const text = await transcribeAudio(audio);
    return NextResponse.json({ text });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Speech-to-text provider failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
