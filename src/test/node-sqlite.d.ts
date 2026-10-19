// Minimal typings for node:sqlite (Node 22.5+). @types/node 20 predates it.
declare module "node:sqlite" {
  export class StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    columns(): { name: string }[];
    setReturnArrays(enabled: boolean): void;
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
