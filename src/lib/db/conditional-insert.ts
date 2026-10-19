import { getTableColumns, getTableName, sql, type SQL } from "drizzle-orm";
import { SQLiteSyncDialect, type SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "@/lib/db/client";

/**
 * Builds `INSERT INTO <table> (...) SELECT <values> WHERE <condition>`.
 * Lets a row be written only when a condition holds, inside the same
 * statement, so it can sit in a D1 batch next to the statement it depends on.
 * Keys of `row` are the Drizzle property names; undefined values are left to
 * the column default.
 */
export function conditionalInsertSql<T extends SQLiteTable>(
  table: T,
  row: Partial<T["$inferInsert"]>,
  condition: SQL,
): SQL {
  const columns = getTableColumns(table) as Record<string, { name: string }>;
  const entries = Object.entries(row).filter(([, v]) => v !== undefined);
  const names = entries.map(([k]) => {
    const col = columns[k];
    if (!col) throw new Error(`unknown column ${k} on ${getTableName(table)}`);
    return sql.identifier(col.name);
  });
  const values = entries.map(([, v]) => sql`${v as unknown}`);
  return sql`INSERT INTO ${sql.identifier(getTableName(table))} (${sql.join(names, sql`, `)})
    SELECT ${sql.join(values, sql`, `)} WHERE ${condition}`;
}

export function changesOf(result: unknown): number {
  return (result as { meta?: { changes?: number } })?.meta?.changes ?? 0;
}

const dialect = new SQLiteSyncDialect();

/**
 * Runs raw SQL statements as one D1 batch (a single transaction). Drizzle's
 * own db.batch() cannot take raw `db.run(sql)` items that carry parameters,
 * so this renders each statement and sends it to the D1 binding directly.
 * Returns the D1 results in order (meta.changes tells what each one did).
 */
export async function runAtomically(db: Db, statements: SQL[]): Promise<unknown[]> {
  const client = (db as unknown as { $client: D1Database }).$client;
  const prepared = statements.map((s) => {
    const q = dialect.sqlToQuery(s);
    return client.prepare(q.sql).bind(...q.params);
  });
  return client.batch(prepared);
}
