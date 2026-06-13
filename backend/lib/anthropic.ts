import Anthropic from "@anthropic-ai/sdk";
import { dataset, type DatasetConfig } from "@/lib/dataset";
import { renderRelevantSchemaForPrompt } from "@/lib/schema";
import {
  ConversationTurn,
  Nl2SqlResult,
  Nl2SqlResultSchema,
} from "@/lib/types";

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

function contextForPrompt(context: ConversationTurn[] = []): string {
  if (!context.length) return "No previous turns.";
  return context
    .slice(-4)
    .map((turn, i) => {
      const columns = turn.columns?.length ? turn.columns.join(", ") : "unknown";
      return [
        `Turn ${i + 1}:`,
        `question: ${turn.question}`,
        `sql: ${turn.sql ?? "none"}`,
        `chartTitle: ${turn.chartTitle ?? "none"}`,
        `columns: ${columns}`,
        `summary: ${turn.summary ?? "none"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function buildSystemPrompt(
  schemaText: string,
  context: ConversationTurn[],
  config: DatasetConfig
): string {
  const unavailable = config.unavailableConcepts.join(", ") || "none";
  const tableNames = config.tables.map((table) => table.name).join(", ");
  return `You are a careful analytics engineer that translates a business question into ONE read-only PostgreSQL query against a fixed schema.

Relevant schema:
${schemaText}

Recent conversation context:
${contextForPrompt(context)}

Hard rules:
- Output a SINGLE SELECT statement only. Never emit INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, COPY, MERGE, multiple statements, or trailing semicolons.
- Only reference these tables: ${tableNames}. Never use pg_* catalogs or information_schema.
- Prefer summary_* tables for charts because they are pre-aggregated.
- Only use columns that exist in the schema above. Never invent columns.
- Use the business glossary definitions exactly. Unavailable concepts for this dataset: ${unavailable}.
- Prefer readable aliases for output columns, such as "department", "items_ordered", "reorder_rate", "day_name", or "order_count".
- Always produce results suitable for the requested chart.
- If the user asks a follow-up such as "that", "those", "now", or "instead", use recent conversation context to infer the prior metric or slice.

Chart guidance:
- type: "line" for trends over time, "bar" for categorical comparisons/rankings, "pie" for share-of-total, "scatter" for correlation, "table" when a chart does not fit.
- x = the column for the x-axis or category, y = the numeric measure column, series = an optional grouping column for multiple lines/bars or null.
- Pick x/y/series to match the column aliases you SELECT.

Clarification:
- If the question is too vague to answer from this schema, set needsClarification=true, provide a short clarificationQuestion, and set sql=null and chart=null.
- If the user asks for unavailable metrics or dimensions, request clarification and suggest available dataset metrics.

You MUST respond by calling the emit_query tool exactly once. Do not write prose outside the tool call.`;
}

const TOOL: Anthropic.Tool = {
  name: "emit_query",
  description:
    "Return the generated SQL, a chart spec, and a one-line explanation, or a clarification request.",
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

export async function generateSql(
  question: string,
  context: ConversationTurn[] = [],
  config: DatasetConfig = dataset
): Promise<Nl2SqlResult> {
  const contextText = context
    .map((turn) => `${turn.question} ${turn.sql ?? ""} ${turn.summary ?? ""}`)
    .join("\n");
  const { schemaText, tables } = renderRelevantSchemaForPrompt(
    question,
    contextText,
    config
  );

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(schemaText, context, config),
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
  return { ...parsed.data, schemaTables: tables };
}
