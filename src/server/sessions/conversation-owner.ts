// Who has a conversation open: HeyTerm reopens a closed session as one of its own, and never while
// another Claude process still has the same conversation open, since two processes writing one
// conversation can tangle it. Pure.

import type { ClaudeSessionRecord } from "./claude-session-status.ts";
import type { SessionView } from "../../shared/types.ts";

export class ConversationOwner {
  static reopenedHere(closed: SessionView, now: number): SessionView {
    return { ...closed, origin: "heyterm", state: "starting", stateSince: now, lastSeenAt: now, pending: undefined, activitySinceSeen: [], quiet: undefined, runningCommand: undefined };
  }

  // The process still holding the session's conversation, from Claude Code's records.
  static liveProcess(session: SessionView, records: Map<string, ClaudeSessionRecord> | undefined, processIsRunning: (pid: number) => boolean): number | undefined {
    if (session.agent !== "claude" || !session.agentSessionId || !records) return undefined;
    const record = records.get(session.agentSessionId);
    return record && processIsRunning(record.pid) ? record.pid : undefined;
  }
}
