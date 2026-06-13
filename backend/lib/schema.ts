import { dataset, type DatasetConfig, type TableDef } from "@/lib/dataset";

export type { ColumnDef, TableDef } from "@/lib/dataset";

export function renderSchemaForPrompt(config: DatasetConfig = dataset): string {
  return renderTables(config.tables, config);
}

export function retrieveRelevantTables(
  question: string,
  contextText = "",
  config: DatasetConfig = dataset
): TableDef[] {
  const text = `${question} ${contextText}`.toLowerCase();
  const names = new Set<string>();

  for (const rule of config.retrievalRules) {
    if (new RegExp(rule.pattern, "i").test(text)) {
      for (const table of rule.tables) names.add(table);
    }
  }

  if (names.size === 0) return config.tables;
  return config.tables.filter((table) => names.has(table.name));
}

export function renderRelevantSchemaForPrompt(
  question: string,
  contextText = "",
  config: DatasetConfig = dataset
): { schemaText: string; tables: string[] } {
  const tables = retrieveRelevantTables(question, contextText, config);
  return {
    schemaText: renderTables(tables, config),
    tables: tables.map((table) => table.name),
  };
}

function renderTables(tables: TableDef[], config: DatasetConfig): string {
  const tableText = tables
    .map((table) => {
      const cols = table.columns
        .map((column) => `    - ${column.name} ${column.type}${column.note ? ` (${column.note})` : ""}`)
        .join("\n");
      const samples = table.sampleRows
        .map((row) => `    ${JSON.stringify(row)}`)
        .join("\n");
      return `TABLE ${table.name}\n  columns:\n${cols}\n  sample rows:\n${samples}`;
    })
    .join("\n\n");

  return `${tableText}\n\n${config.glossary}`;
}
