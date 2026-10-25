import type { Db } from "./db.js";

export type Decision = "allowed" | "denied";

/** A row of `audit_log`; `args` is the JSON text exactly as stored. */
export interface AuditEntry {
  id: number;
  username: string;
  tool: string;
  args: string;
  decision: Decision;
  reason: string | null;
  timestamp: string;
}

export interface NewAuditEntry {
  username: string;
  tool: string;
  args: unknown;
  decision: Decision;
  reason?: string;
}

export function writeAudit(db: Db, entry: NewAuditEntry): void {
  db.prepare(
    "INSERT INTO audit_log (username, tool, args, decision, reason) VALUES (?, ?, ?, ?, ?)",
  ).run(entry.username, entry.tool, JSON.stringify(entry.args ?? {}), entry.decision, entry.reason ?? null);
}

/** Newest entries first. */
export function readAudit(db: Db, limit: number): AuditEntry[] {
  return db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").all(limit) as AuditEntry[];
}
