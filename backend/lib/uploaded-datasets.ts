import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { DatasetConfig, TableDef } from "@/lib/dataset";
import { dataset as defaultDataset } from "@/lib/dataset";

const UPLOAD_DIR = join(process.cwd(), "backend", "uploads");
const TABLE_NAME = "uploaded_rows";
const MAX_ROWS = 5000;
const MAX_COLUMNS = 60;
const MAX_BYTES = 8 * 1024 * 1024;

interface UploadedDatasetFile {
  id: string;
  name: string;
  createdAt: string;
  columns: { source: string; name: string; type: string }[];
  rows: Record<string, unknown>[];
}

export interface DatasetSummary {
  id: string;
  name: string;
  createdAt?: string;
  rowCount?: number;
  columns?: string[];
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  await ensureUploadDir();
  const files = await readdir(UPLOAD_DIR);
  const uploaded = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const data = await readUploaded(file.replace(/\.json$/, ""));
        return {
          id: data.id,
          name: data.name,
          createdAt: data.createdAt,
          rowCount: data.rows.length,
          columns: data.columns.map((column) => column.name),
        };
      })
  );
  return [
    {
      id: defaultDataset.id,
      name: defaultDataset.name,
      rowCount: undefined,
      columns: defaultDataset.tables.flatMap((table) =>
        table.columns.map((column) => `${table.name}.${column.name}`)
      ),
    },
    ...uploaded,
  ];
}

export async function saveUploadedDataset(input: {
  filename: string;
  bytes: Buffer;
}): Promise<DatasetSummary> {
  if (input.bytes.length > MAX_BYTES) {
    throw new Error("CSV is too large.");
  }
  const csv = input.bytes.toString("utf8");
  const parsed = parseCsv(csv);
  if (parsed.rows.length === 0) throw new Error("CSV has no data rows.");
  if (parsed.headers.length > MAX_COLUMNS) {
    throw new Error(`CSV has too many columns. Maximum is ${MAX_COLUMNS}.`);
  }

  const id = `upload_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const columns = parsed.headers.map((source, index) => ({
    source,
    name: uniqueIdentifier(source, index, parsed.headers),
    type: inferColumnType(parsed.rows.map((row) => row[index])),
  }));
  const rows = parsed.rows.slice(0, MAX_ROWS).map((row) => {
    const next: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      next[columns[i].name] = coerceValue(row[i] ?? "", columns[i].type);
    }
    return next;
  });

  const data: UploadedDatasetFile = {
    id,
    name: cleanDatasetName(input.filename),
    createdAt: new Date().toISOString(),
    columns,
    rows,
  };
  await ensureUploadDir();
  await writeFile(pathFor(id), JSON.stringify(data, null, 2), "utf8");
  return {
    id,
    name: data.name,
    createdAt: data.createdAt,
    rowCount: data.rows.length,
    columns: columns.map((column) => column.name),
  };
}

export async function getDatasetConfig(datasetId?: string): Promise<DatasetConfig> {
  if (!datasetId || datasetId === defaultDataset.id) return defaultDataset;
  const uploaded = await readUploaded(datasetId);
  return configFromUploaded(uploaded);
}

export async function getUploadedRows(
  datasetId?: string
): Promise<Record<string, unknown>[] | null> {
  if (!datasetId || datasetId === defaultDataset.id) return null;
  const uploaded = await readUploaded(datasetId);
  return uploaded.rows;
}

function configFromUploaded(uploaded: UploadedDatasetFile): DatasetConfig {
  const table: TableDef = {
    name: TABLE_NAME,
    columns: uploaded.columns.map((column) => ({
      name: column.name,
      type: column.type,
      note: column.source !== column.name ? `source: ${column.source}` : undefined,
    })),
    sampleRows: uploaded.rows.slice(0, 3),
  };
  return {
    id: uploaded.id,
    name: uploaded.name,
    description: `Uploaded CSV dataset with ${uploaded.rows.length} rows.`,
    unavailableConcepts: [],
    tables: [table],
    glossary: [
      `Dataset: ${uploaded.name}.`,
      `Use table ${TABLE_NAME}.`,
      "Use only the listed columns.",
      "For counts, use COUNT(*).",
      "For numeric columns, SUM, AVG, MIN, and MAX are available.",
    ].join("\n"),
    retrievalRules: [{ pattern: ".*", tables: [TABLE_NAME] }],
    exampleQuestions: uploaded.columns.slice(0, 5).map((column) => ({
      text:
        column.type === "numeric" || column.type === "int"
          ? `Average ${column.name}`
          : `Count rows by ${column.name}`,
      tag: column.type === "numeric" || column.type === "int" ? "Metric" : "Group",
    })),
    evalCases: [],
    demoRows: {
      [TABLE_NAME]: uploaded.rows,
    },
  };
}

function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  row.push(field);
  records.push(row);

  const nonEmpty = records.filter((record) =>
    record.some((value) => value.trim() !== "")
  );
  const headers = nonEmpty[0]?.map((header, index) =>
    header.trim() || `column_${index + 1}`
  );
  if (!headers?.length) throw new Error("CSV has no header row.");
  return {
    headers,
    rows: nonEmpty.slice(1).filter((record) => record.length > 0),
  };
}

function inferColumnType(values: string[]): string {
  const filled = values.map((value) => value.trim()).filter(Boolean);
  if (!filled.length) return "text";
  if (filled.every((value) => /^-?\d+$/.test(value))) return "int";
  if (filled.every((value) => /^-?\d+(\.\d+)?$/.test(value))) return "numeric";
  if (filled.every((value) => !Number.isNaN(Date.parse(value)))) return "date";
  if (filled.every((value) => /^(true|false|yes|no|0|1)$/i.test(value))) {
    return "boolean";
  }
  return "text";
}

function coerceValue(value: string, type: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (type === "int") return Number.parseInt(trimmed, 10);
  if (type === "numeric") return Number(trimmed);
  if (type === "boolean") return /^(true|yes|1)$/i.test(trimmed);
  return trimmed;
}

function uniqueIdentifier(source: string, index: number, headers: string[]): string {
  const base = sanitizeIdentifier(source) || `column_${index + 1}`;
  const prior = headers.slice(0, index).map(sanitizeIdentifier);
  const count = prior.filter((value) => value === base).length;
  return count ? `${base}_${count + 1}` : base;
}

function sanitizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "col_$1")
    .slice(0, 48);
}

function cleanDatasetName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded dataset";
}

async function readUploaded(id: string): Promise<UploadedDatasetFile> {
  if (!/^upload_[a-f0-9]{16}$/.test(id)) throw new Error("Unknown dataset.");
  const path = pathFor(id);
  if (!existsSync(path)) throw new Error("Unknown dataset.");
  return JSON.parse(await readFile(path, "utf8")) as UploadedDatasetFile;
}

function pathFor(id: string): string {
  return join(UPLOAD_DIR, `${id}.json`);
}

async function ensureUploadDir(): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true });
}
