import Anthropic from "@anthropic-ai/sdk";
import { renderSchemaForPrompt } from "@/lib/schema";
import { Nl2SqlResult, Nl2SqlResultSchema } from "@/lib/types";

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

const SYSTEM_PROMPT = `You are a careful analytics engineer that translates a business question into ONE read-only PostgreSQL query against a fixed schema.

${renderSchemaForPrompt()}

Hard rules:
- Output a SINGLE SELECT statement only. NEVER emit INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, COPY, MERGE, multiple statements, or trailing semicolons.
- Only reference these tables: departments, aisles, products, orders, order_items, summary_orders_by_dow, summary_orders_by_hour, summary_department_stats, summary_product_stats. Never use pg_* catalogs or information_schema.
- PREFER summary_* tables for charts (they are pre-aggregated): summary_orders_by_dow for day-of-week, summary_orders_by_hour for hourly patterns, summary_department_stats for department rankings/reorder rates, summary_product_stats for top products. Only scan orders/order_items when the question needs a filter summaries do not support (e.g. eval_set, order_number).
- Only use columns that exist in the schema above. Never invent columns or calendar dates (Instacart has no order_date).
- Use the business glossary definitions exactly (items_ordered, reorder_rate, etc. — there is no revenue).
- Prefer readable aliases for output columns (e.g. "revenue", "quarter", "region") because they become chart axis labels.
- Always produce results suitable for the requested chart (e.g. ordered by time for line charts).

Chart guidance:
- type: "line" for trends over time, "bar" for categorical comparisons/rankings, "pie" for share-of-total, "scatter" for correlation, "table" when a chart doesn't fit.
- x = the column for the x-axis (or category), y = the numeric measure column, series = an optional grouping column for multiple lines/bars (or null).
- Pick x/y/series to match the column aliases you SELECT.

Clarification:
- If the question is too vague to answer from this schema (e.g. "how are we doing?"), set needsClarification=true, provide a short clarificationQuestion, and set sql=null and chart=null.

You MUST respond by calling the emit_query tool exactly once. Do not write prose outside the tool call.`;

const TOOL: Anthropic.Tool = {
  name: "emit_query",
  description:
    "Return the generated SQL, a chart spec, and a one-line explanation (or a clarification request).",
  input_schema: {
    type: "object",
    properties: {
      sql: {
        type: ["string", "null"],
        description: "A single read-only SELECT statement, or null if clarification is needed.",
      },
      chart: {
        type: ["object", "null"],
        properties: {
          type: { type: "string", enum: ["bar", "line", "pie", "scatter", "table"] },
          x: { type: ["string", "null"] },
          y: { type: ["string", "null"] },
          series: { type: ["string", "null"] },
          title: { type: "string" },
        },
        required: ["type", "x", "y", "series", "title"],
        additionalProperties: false,
      },
      explanation: {
        type: "string",
        description: "One short plain-English sentence describing what the query returns.",
      },
      needsClarification: { type: "boolean" },
      clarificationQuestion: { type: ["string", "null"] },
    },
    required: [
      "sql",
      "chart",
      "explanation",
      "needsClarification",
      "clarificationQuestion",
    ],
    additionalProperties: false,
  },
};

export async function generateSql(question: string): Promise<Nl2SqlResult> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "emit_query" },
    messages: [{ role: "user", content: question }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Model did not return a structured tool response.");
  }

  const parsed = Nl2SqlResultSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(
      `Model output failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`
    );
  }
  return parsed.data;
}
