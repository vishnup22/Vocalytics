import OpenAI from "openai";
import { toFile } from "openai/uploads";

type Provider = "openai" | "groq";

interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

function resolveProvider(): ProviderConfig {
  const provider = (process.env.STT_PROVIDER ?? "openai") as Provider;
  if (provider === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    return {
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
      model: "whisper-large-v3",
    };
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return { apiKey, model: "whisper-1" };
}

export async function transcribeAudio(
  audio: Blob,
  filename = "recording.webm"
): Promise<string> {
  const { apiKey, baseURL, model } = resolveProvider();
  const client = new OpenAI({ apiKey, baseURL });

  const buffer = Buffer.from(await audio.arrayBuffer());
  const file = await toFile(buffer, filename, {
    type: audio.type || "audio/webm",
  });

  const result = await client.audio.transcriptions.create({
    file,
    model,
    language: "en",
  });
  return result.text;
}
