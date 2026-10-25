// What the assistant remembers across a HeyTerm restart: the id of its Claude conversation, which it
// resumes, and the lines the conversation column showed. One small file in HeyTerm's data folder.

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ConversationEntry } from "../../shared/protocol.ts";

interface Remembered {
  sessionId?: string;
  entries?: ConversationEntry[];
}

export class AssistantMemory {
  private readonly filePath: string;
  private remembered: Remembered;

  constructor(dataDirectory: string) {
    this.filePath = path.join(dataDirectory, "assistant.json");
    this.remembered = readRemembered(this.filePath);
  }

  sessionId(): string | undefined {
    return this.remembered.sessionId;
  }

  entries(): ConversationEntry[] {
    return this.remembered.entries ?? [];
  }

  rememberSession(sessionId: string): void {
    if (this.remembered.sessionId === sessionId) return;
    this.write({ ...this.remembered, sessionId });
  }

  forgetSession(): void {
    const { sessionId: _forgotten, ...rest } = this.remembered;
    this.write(rest);
  }

  rememberEntries(entries: ConversationEntry[]): void {
    this.write({ ...this.remembered, entries });
  }

  private write(remembered: Remembered): void {
    this.remembered = remembered;
    // Written beside it and renamed, so a crash mid-write never leaves half a file.
    const temporaryPath = `${this.filePath}.tmp`;
    try {
      writeFileSync(temporaryPath, JSON.stringify(remembered), { mode: 0o600 });
      renameSync(temporaryPath, this.filePath);
    } catch {
      // Memory is a convenience; HeyTerm works without it.
    }
  }
}

function readRemembered(filePath: string): Remembered {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Remembered) : {};
  } catch {
    return {};
  }
}
