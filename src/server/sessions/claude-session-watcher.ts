// Reads Claude Code's records of its running sessions every few seconds and lets the registry catch
// up with what the hooks never report: a turn the user stopped, and a terminal closed without an end.
// The rules are in claude-session-status.ts.

import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ClaudeSessionStatus, type ClaudeSessionRecord } from "./claude-session-status.ts";
import { TerminalLinks } from "./terminal-links.ts";
import type { SessionRegistry } from "./session-registry.ts";
import type { Terminals } from "../terminals/terminals.ts";

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

  // shouldDiscover: whether running sessions found only in the records are listed (Setup's "Show
  // your own sessions"); they join as the developer's own, like sessions their hooks report.
  constructor(
    private readonly registry: SessionRegistry,
    private readonly shouldDiscover: () => Promise<boolean> = async () => false,
    // HeyTerm's terminals, to tell a Claude started by hand in one of them (terminal-links.ts).
    private readonly terminals?: Pick<Terminals, "processesOnScreen">,
  ) {}

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
      if (records) {
        await this.linkClaudesInTerminals(records);
        this.registry.reconcileClaudeSessions(records, ClaudeSessionRecords.processIsRunning, Date.now());
        if (await this.shouldDiscover()) this.registry.discoverOutsideSessions(records.values(), ClaudeSessionRecords.processIsRunning, [], Date.now());
      }
      else if (!this.hasPolled) this.registry.forgetExternalSessions();
      this.hasPolled = true;
    } finally {
      this.polling = false;
    }
  }

  private async linkClaudesInTerminals(records: Map<string, ClaudeSessionRecord>): Promise<void> {
    if (!this.terminals) return;
    const terminalSessions = this.registry.localSessions().filter((session) => session.agent === "shell" && session.origin !== "external");
    const terminals = await Promise.all(terminalSessions.map(async (session) => ({ name: session.name, processes: await this.terminals!.processesOnScreen(session.name) })));
    const links = TerminalLinks.find(terminals, [...records.values()]);
    const now = Date.now();
    for (const link of links) this.registry.linkIntoTerminal(link.terminal, link.agentSessionId, now);
    // Only a terminal that was read (its shell is always listed) can be said to have no Claude left.
    for (const terminal of terminals) {
      const wasLinked = this.registry.get(terminal.name)?.claudeInside === true;
      if (wasLinked && terminal.processes.length > 0 && !links.some((link) => link.terminal === terminal.name)) this.registry.unlinkFromTerminal(terminal.name, now);
    }
  }
}
