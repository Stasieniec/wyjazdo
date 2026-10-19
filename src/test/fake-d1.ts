/**
 * In-memory stand-in for a Cloudflare D1 binding, backed by node:sqlite.
 * Used by tests that need the real SQL (capacity checks, batches, conditional
 * updates) to run. Applies every migration in src/lib/db/migrations in order.
 */
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";

type Row = Record<string, unknown>;

function normalize(params: unknown[]): (string | number | bigint | null | Uint8Array)[] {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    return p as string | number;
  });
}

class FakeStatement {
  constructor(
    private db: DatabaseSync,
    readonly sql: string,
    private params: unknown[] = [],
  ) {}
  bind(...params: unknown[]) {
    return new FakeStatement(this.db, this.sql, params);
  }
  private stmt(): StatementSync {
    return this.db.prepare(this.sql);
  }
  execute(): { results: Row[]; meta: { changes: number; last_row_id: number } } {
    const s = this.stmt();
    const args = normalize(this.params);
    if (s.columns().length > 0) {
      const results = s.all(...args) as Row[];
      return { results, meta: { changes: results.length, last_row_id: 0 } };
    }
    const r = s.run(...args);
    return { results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async run() {
    return { success: true, ...this.execute() };
  }
  async all() {
    return { success: true, ...this.execute() };
  }
  async first(col?: string) {
    const row = this.execute().results[0];
    if (!row) return null;
    return col ? row[col] : row;
  }
  async raw() {
    const s = this.stmt();
    s.setReturnArrays(true);
    return s.all(...normalize(this.params)) as unknown[][];
  }
}

export class FakeD1 {
  readonly sqlite: DatabaseSync;
  /** When set, called before each batch; lets tests interleave writes. */
  beforeBatch: (() => void) | null = null;

  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("PRAGMA foreign_keys = ON;");
    const dir = path.resolve(__dirname, "../lib/db/migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      const text = readFileSync(path.join(dir, f), "utf8");
      for (const chunk of text.split("--> statement-breakpoint")) {
        if (chunk.trim()) this.sqlite.exec(chunk);
      }
    }
  }
  prepare(sql: string) {
    return new FakeStatement(this.sqlite, sql);
  }
  async batch(stmts: FakeStatement[]) {
    this.beforeBatch?.();
    this.sqlite.exec("BEGIN");
    try {
      const out = stmts.map((s) => ({ success: true, ...s.execute() }));
      this.sqlite.exec("COMMIT");
      return out;
    } catch (err) {
      this.sqlite.exec("ROLLBACK");
      throw err;
    }
  }
  async exec(sql: string) {
    this.sqlite.exec(sql);
    return { count: 0, duration: 0 };
  }
}

export function makeTestDb() {
  const d1 = new FakeD1();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = drizzle(d1 as any, { schema });
  return { d1, db };
}
