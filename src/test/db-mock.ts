/**
 * Shared state for tests that point getDb() at the in-memory D1. Each test
 * file does:
 *
 *   vi.mock("@/lib/db/client", () => import("@/test/db-mock").then((m) => m.dbClientMock()));
 *
 * and calls resetTestDb() in beforeEach.
 */
import { makeTestDb } from "./fake-d1";
import * as schema from "@/lib/db/schema";

let current = makeTestDb();

export function resetTestDb() {
  current = makeTestDb();
  return current;
}

export function testDb() {
  return current;
}

export function dbClientMock() {
  return { getDb: () => current.db, schema };
}

export function rows<T = Record<string, unknown>>(sqlText: string, ...params: unknown[]): T[] {
  return current.d1.sqlite.prepare(sqlText).all(...params) as T[];
}
