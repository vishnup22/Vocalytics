import Anthropic from "@anthropic-ai/sdk";
import type { ChartSpec } from "@/lib/types";

const MODEL = "claude-sonnet-4-20250514";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function generateInsight(input: {
  question: string;
  sql: string;
  chart: ChartSpec;
  columns: string[];
  rows: Record<string, unknown>[];
}): Promise<string> {
  const rows = input.rows.slice(0, 50);
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 160,
    system:
      "You write one concise analytics insight grounded only in the provided query result. Do not mention unavailable metrics or speculate beyond the rows.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          question: input.question,
          chart: input.chart,
          columns: input.columns,
          rows,
        }),
      },
    ],
  });
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join(" ")
    .trim();
  return text || "The result is ready for review.";
}
