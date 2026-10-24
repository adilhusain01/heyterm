// Every decision made for an agent, by voice or click, one JSON line each in ~/.callsign/audit.jsonl.

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface AuditEntry {
  session: string;
  decision: "approved" | "denied" | "answered" | "trusted" | "closed";
  subject: string;
  // The words that decided it, or "click" when it was a button.
  decidedBy: string;
  risk?: string;
}

export class AuditLog {
  private readonly filePath: string;

  constructor(dataDirectory: string) {
    this.filePath = path.join(dataDirectory, "audit.jsonl");
  }

  async record(entry: AuditEntry): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, { mode: 0o600 });
  }
}
