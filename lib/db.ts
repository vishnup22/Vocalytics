import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      ssl: shouldUseSsl(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return pool;
}

function shouldUseSsl(connectionString: string): boolean {
  if (/sslmode=disable/.test(connectionString)) return false;
  if (/sslmode=require/.test(connectionString)) return true;
  return !/@localhost|@127\.0\.0\.1/.test(connectionString);
}

export interface ReadOnlyResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export async function runReadOnly(sql: string): Promise<ReadOnlyResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5s'");
    const result = await client.query(sql);
    await client.query("COMMIT");
    const columns = result.fields.map((f) => f.name);
    return {
      columns,
      rows: result.rows as Record<string, unknown>[],
      rowCount: result.rowCount ?? result.rows.length,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      void 0;
    }
    throw err;
  } finally {
    client.release();
  }
}
