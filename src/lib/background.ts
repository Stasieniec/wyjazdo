import { after } from "next/server";

/**
 * Runs work after the response is sent without letting the Worker drop it.
 * A bare un-awaited promise can be killed when the request ends; after()
 * keeps the Worker alive (waitUntil under OpenNext) until it settles.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>): void {
  after(async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[background] ${label} failed`, err);
    }
  });
}
