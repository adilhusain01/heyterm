// ~/.callsign/input-log.jsonl: how text reached the page, kinds and lengths only, the last lines kept.

import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const keptLines = 1_000;

export class InputLog {
  private readonly filePath: string;
  private writing = Promise.resolve();

  constructor(dataDirectory: string) {
    this.filePath = path.join(dataDirectory, "input-log.jsonl");
  }

  record(records: Array<Record<string, unknown>>): void {
    const safe = records.slice(0, 500).map((record) => JSON.stringify(withoutText(record))).join("\n");
    if (!safe) return;
    this.writing = this.writing
      .then(async () => {
        await appendFile(this.filePath, `${safe}\n`, { mode: 0o600 });
        const lines = (await readFile(this.filePath, "utf8")).split("\n").filter(Boolean);
        if (lines.length > keptLines * 2) await writeFile(this.filePath, `${lines.slice(-keptLines).join("\n")}\n`, { mode: 0o600 });
      })
      .catch(() => undefined);
  }
}

// Only these fields are kept, whatever a page sends, so no words can end up in the file.
function withoutText(record: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const key of ["at", "type", "inputType", "length", "key", "target", "windowHasFocus"]) {
    const value = record[key];
    if (typeof value === "number" || typeof value === "boolean" || (typeof value === "string" && value.length <= 40)) kept[key] = value;
  }
  return kept;
}
