import type { ZodIssue } from "zod";

/** First message per top-level field path (matches common `name` attributes). */
export function zodIssuesToRecord(issues: ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
