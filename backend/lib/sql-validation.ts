import type { ChartSpec } from "@/lib/types";
import { dataset, type DatasetConfig } from "@/lib/dataset";

export interface SqlValidationResult {
  ok: boolean;
  warnings: string[];
}

function selectedAliases(sql: string): Set<string> {
  const match = sql.match(/select\s+([\s\S]+?)\s+from\s/i);
  if (!match) return new Set();
  const selectList = match[1]
    .split(/,(?![^()]*\))/)
    .map((part) => part.trim());
  const aliases = new Set<string>();
  for (const item of selectList) {
    const asMatch = item.match(/\bas\s+"?([a-zA-Z0-9_ ]+)"?$/i);
    if (asMatch) {
      aliases.add(asMatch[1]);
      continue;
    }
    const bare = item.match(/"?([a-zA-Z_][a-zA-Z0-9_]*)"?$/);
    if (bare) aliases.add(bare[1]);
  }
  return aliases;
}

export function validateGeneratedQuery(
  question: string,
  sql: string,
  chart: ChartSpec,
  config: DatasetConfig = dataset
): SqlValidationResult {
  const warnings: string[] = [];
  const q = question.toLowerCase();
  const lowerSql = sql.toLowerCase();

  const unavailable = config.unavailableConcepts.filter((concept) =>
    new RegExp(`\\b${escapeRegExp(concept)}\\b`, "i").test(q)
  );
  if (unavailable.length) {
    warnings.push(`Question asks for unavailable dataset concepts: ${unavailable.join(", ")}.`);
  }
  for (const concept of config.unavailableConcepts) {
    if (new RegExp(`\\b${escapeRegExp(concept.replace(/\s+/g, "_"))}\\b`, "i").test(lowerSql)) {
      warnings.push(`SQL appears to use unavailable dataset concept: ${concept}.`);
    }
  }
  if (/\bsummary_/.test(lowerSql) === false && /\b(day of week|hour|top|reorder rate|department|product)\b/.test(q)) {
    warnings.push("Query may be scanning raw tables where a summary table is available.");
  }

  const aliases = selectedAliases(sql);
  for (const field of [chart.x, chart.y, chart.series]) {
    if (field && !aliases.has(field)) {
      warnings.push(`Chart field "${field}" does not exactly match a selected column alias.`);
    }
  }

  return { ok: warnings.length === 0, warnings };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
