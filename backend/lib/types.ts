import { z } from "zod";

export const ChartSpecSchema = z.object({
  type: z.enum(["bar", "line", "pie", "scatter", "table"]),
  x: z.string().nullable(),
  y: z.string().nullable(),
  series: z.string().nullable(),
  title: z.string(),
});
export type ChartSpec = z.infer<typeof ChartSpecSchema>;

export const ConversationTurnSchema = z.object({
  question: z.string().min(1).max(1000),
  sql: z.string().nullable().optional(),
  chartTitle: z.string().nullable().optional(),
  columns: z.array(z.string()).optional(),
  summary: z.string().nullable().optional(),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

export const Nl2SqlResultSchema = z.object({
  sql: z.string().nullable(),
  chart: ChartSpecSchema.nullable(),
  explanation: z.string(),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  validationWarnings: z.array(z.string()).optional(),
  schemaTables: z.array(z.string()).optional(),
});
export type Nl2SqlResult = z.infer<typeof Nl2SqlResultSchema>;

export const Nl2SqlRequestSchema = z.object({
  question: z.string().min(1, "question is required").max(1000),
  context: z.array(ConversationTurnSchema).max(6).optional(),
  datasetId: z.string().min(1).max(120).optional(),
});
export type Nl2SqlRequest = z.infer<typeof Nl2SqlRequestSchema>;

export const QueryRequestSchema = z.object({
  sql: z.string().min(1, "sql is required"),
  datasetId: z.string().min(1).max(120).optional(),
});
export type QueryRequest = z.infer<typeof QueryRequestSchema>;

export const QueryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  rowCount: z.number(),
  cacheHit: z.boolean().optional(),
  latencyMs: z.number().optional(),
  demo: z.boolean().optional(),
  warning: z.string().optional(),
});
export type QueryResult = z.infer<typeof QueryResultSchema>;

export const InsightRequestSchema = z.object({
  question: z.string().min(1).max(1000),
  sql: z.string().min(1),
  chart: ChartSpecSchema,
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())).max(1000),
});
export type InsightRequest = z.infer<typeof InsightRequestSchema>;

export const InsightResultSchema = z.object({
  insight: z.string(),
});
export type InsightResult = z.infer<typeof InsightResultSchema>;

export const TranscribeResultSchema = z.object({
  text: z.string(),
});
export type TranscribeResult = z.infer<typeof TranscribeResultSchema>;
