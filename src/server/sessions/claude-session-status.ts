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
  // What a session HeyTerm has not heard from is shown as: its name ("user" when someone gave it),
  // its folder, and what kind of run it is ("interactive", "bg" for a background job; "cli" or an SDK).
  name?: string;
  nameSource?: string;
  cwd?: string;
  kind?: string;
  entrypoint?: string;
  startedAt?: number;
}

// Runs a person works in. Print runs (claude -p) end by themselves, and SDK sessions belong to the
// program that started them, HeyTerm's own assistant among them.
const listedKinds = ["interactive", "bg"];
// A session HeyTerm starts has reported its id through its first hook by then.
const discoveryDelayMilliseconds = 10_000;

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

  // Running command-line sessions HeyTerm does not know yet: started before its hooks were in their
  // settings, or idle since, so they never reported.
  static undiscovered(records: Iterable<ClaudeSessionRecord>, knownSessionIds: Set<string>, processIsRunning: (pid: number) => boolean, now?: number): ClaudeSessionRecord[] {
    const isSettled = (record: ClaudeSessionRecord) => now === undefined || record.startedAt === undefined || now - record.startedAt >= discoveryDelayMilliseconds;
    return [...records].filter(
      (record) =>
        record.entrypoint === "cli" && listedKinds.includes(record.kind ?? "") && Boolean(record.cwd) && !knownSessionIds.has(record.sessionId) && isSettled(record) && processIsRunning(record.pid),
    );
  }

  // "waiting" is Claude asking in its terminal; HeyTerm holds nothing for a session found this way.
  static stateFromStatus(status: string | undefined): SessionState {
    if (status === "busy") return "working";
    if (status === "waiting") return "asked";
    return "idle";
  }

  // The name someone gave the session. One Claude made up, or the start of its id, says less than its folder.
  static shownName(record: ClaudeSessionRecord): string | undefined {
    if (!record.name || record.nameSource === "derived" || record.sessionId.startsWith(record.name)) return undefined;
    return record.name;
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
    const textField = (field: string) => (typeof fields[field] === "string" && fields[field] ? { [field]: fields[field] as string } : {});
    return {
      pid: fields.pid,
      sessionId: fields.sessionId,
      ...textField("status"),
      ...(typeof fields.statusUpdatedAt === "number" ? { statusUpdatedAt: fields.statusUpdatedAt } : {}),
      ...(typeof fields.startedAt === "number" ? { startedAt: fields.startedAt } : {}),
      ...textField("name"),
      ...textField("nameSource"),
      ...textField("cwd"),
      ...textField("kind"),
      ...textField("entrypoint"),
    };
  }
}
