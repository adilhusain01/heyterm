// Reads Claude Code's records of its running sessions every few seconds and lets the registry catch
// up with what the hooks never report: a turn the user stopped, and a terminal closed without an end.
// The rules are in claude-session-status.ts.

import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ClaudeSessionStatus, type ClaudeSessionRecord } from "./claude-session-status.ts";
import type { SessionRegistry } from "./session-registry.ts";

const pollMilliseconds = 2_000;

// HEYTERM_CLAUDE_SESSIONS_DIRECTORY points HeyTerm alone somewhere else, for tests.
function claudeSessionsDirectory(): string {
  return process.env.HEYTERM_CLAUDE_SESSIONS_DIRECTORY ?? path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude"), "sessions");
}

// Claude Code's records of its running sessions, read by the watcher and by the launcher before it
// opens a conversation that may still be open in another process.
export class ClaudeSessionRecords {
  static read(): Promise<Map<string, ClaudeSessionRecord> | undefined> {
    return ClaudeSessionRecords.readFrom(claudeSessionsDirectory());
  }

  static async readFrom(directory: string): Promise<Map<string, ClaudeSessionRecord> | undefined> {
    const names = await readdir(directory).catch(() => undefined);
    if (!names) return undefined;
    const records = new Map<string, ClaudeSessionRecord>();
    const recordFileNames = names.filter((name) => name.endsWith(".json"));
    for (const name of recordFileNames) {
      const text = await readFile(path.join(directory, name), "utf8").catch(() => "");
      const record = ClaudeSessionStatus.parseRecord(text);
      if (record) records.set(record.sessionId, record);
    }
    return ClaudeSessionStatus.recordsCanBeTrusted(recordFileNames.length, records.size) ? records : undefined;
  }

  // Signal 0 checks a process exists without touching it; EPERM means it exists under another user.
  static processIsRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  }
}

export class ClaudeSessionWatcher {
  private timer: NodeJS.Timeout | undefined;
  private polling = false;
  private hasPolled = false;

  constructor(private readonly registry: SessionRegistry) {}

  start(): void {
    this.timer = setInterval(() => void this.poll(), pollMilliseconds);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const records = await ClaudeSessionRecords.read();
      // A Claude Code too old to keep records tells HeyTerm nothing. Sessions kept from before a
      // restart cannot be checked then, so they go, as they always did; hooks bring live ones back.
      if (records) this.registry.reconcileClaudeSessions(records, ClaudeSessionRecords.processIsRunning, Date.now());
      else if (!this.hasPolled) this.registry.forgetExternalSessions();
      this.hasPolled = true;
    } finally {
      this.polling = false;
    }
  }
}
