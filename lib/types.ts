import { z } from "zod";

export const ChartSpecSchema = z.object({
  type: z.enum(["bar", "line", "pie", "scatter", "table"]),
  x: z.string().nullable(),
  y: z.string().nullable(),
  series: z.string().nullable(),
  title: z.string(),
});
export type ChartSpec = z.infer<typeof ChartSpecSchema>;

export const Nl2SqlResultSchema = z.object({
  sql: z.string().nullable(),
  chart: ChartSpecSchema.nullable(),
  explanation: z.string(),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
});
export type Nl2SqlResult = z.infer<typeof Nl2SqlResultSchema>;

export const Nl2SqlRequestSchema = z.object({
  question: z.string().min(1, "question is required").max(1000),
});
export type Nl2SqlRequest = z.infer<typeof Nl2SqlRequestSchema>;

export const QueryRequestSchema = z.object({
  sql: z.string().min(1, "sql is required"),
});
export type QueryRequest = z.infer<typeof QueryRequestSchema>;

export const QueryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  rowCount: z.number(),
});
export type QueryResult = z.infer<typeof QueryResultSchema>;

export const TranscribeResultSchema = z.object({
  text: z.string(),
});
export type TranscribeResult = z.infer<typeof TranscribeResultSchema>;
