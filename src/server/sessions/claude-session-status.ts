// What Claude Code's own record of a running session says that no hook does. Claude Code keeps one
// file per live process in ~/.claude/sessions (pid, session id, and a status of busy, waiting, idle or
// shell). It sends no Stop hook when the user interrupts a turn, and no SessionEnd when its terminal
// is closed, so the record is how HeyTerm learns of both. Pure.

import type { SessionState, SessionView } from "../../shared/types.ts";

export interface ClaudeSessionRecord {
  pid: number;
  sessionId: string;
  status?: string;
  statusUpdatedAt?: number;
}

export type ClaudeSessionVerdict = "turn_stopped" | "ended";

// States a turn can be in while Claude Code is still working on it or waiting inside it.
const statesInsideATurn: SessionState[] = ["working", "needs_permission", "asked"];
// Statuses that mean no turn is running. "waiting" is Claude asking the user, which hooks report.
const statusesWithoutATurn = ["idle", "shell"];

export class ClaudeSessionStatus {
  // The Stop hook can land just after the record turns idle; a real end of turn wins.
  static readonly settleMilliseconds = 3_000;
  // A session that only just appeared may not have written its record yet.
  static readonly endGraceMilliseconds = 30_000;

  static verdict(session: SessionView, record: ClaudeSessionRecord | undefined, processIsRunning: boolean, now: number): ClaudeSessionVerdict | undefined {
    if (session.agent !== "claude" || !session.agentSessionId || session.state === "stopped") return undefined;
    if (!record || !processIsRunning) {
      // HeyTerm's own sessions end with their terminal, which HeyTerm sees.
      if (session.origin !== "external") return undefined;
      return now - session.stateSince >= ClaudeSessionStatus.endGraceMilliseconds ? "ended" : undefined;
    }
    if (!statesInsideATurn.includes(session.state)) return undefined;
    if (!record.status || !statusesWithoutATurn.includes(record.status)) return undefined;
    const statusChangedAt = record.statusUpdatedAt ?? 0;
    if (statusChangedAt <= session.stateSince) return undefined;
    return now - statusChangedAt >= ClaudeSessionStatus.settleMilliseconds ? "turn_stopped" : undefined;
  }

  // A folder with no records means no Claude is running. Record files of which none can be read
  // mean Claude Code changed how it writes them, which says nothing about the sessions.
  static recordsCanBeTrusted(recordFileCount: number, readableRecordCount: number): boolean {
    return recordFileCount === 0 || readableRecordCount > 0;
  }

  static parseRecord(text: string): ClaudeSessionRecord | undefined {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return undefined;
    }
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const fields = parsed as Record<string, unknown>;
    if (typeof fields.pid !== "number" || typeof fields.sessionId !== "string" || !fields.sessionId) return undefined;
    return {
      pid: fields.pid,
      sessionId: fields.sessionId,
      ...(typeof fields.status === "string" ? { status: fields.status } : {}),
      ...(typeof fields.statusUpdatedAt === "number" ? { statusUpdatedAt: fields.statusUpdatedAt } : {}),
    };
  }
}
