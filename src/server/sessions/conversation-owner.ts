// Who has a conversation open: HeyTerm reopens a closed session as one of its own, and never while
// another Claude process still has the same conversation open, since two processes writing one
// conversation can tangle it. Pure.

import type { ClaudeSessionRecord } from "./claude-session-status.ts";
import type { SessionView } from "../../shared/types.ts";

export class ConversationOwner {
  static reopenedHere(closed: SessionView, now: number): SessionView {
    return { ...closed, origin: "heyterm", state: "starting", stateSince: now, lastSeenAt: now, pending: undefined, activitySinceSeen: [], quiet: undefined, runningCommand: undefined };
  }

  // A Claude conversation runs in the folder it was filed under, even when the session had been
  // put in a worktree; the worktree stays only if that folder is inside it.
  static inItsConversationsFolder(session: SessionView, conversationFolder: string, conversationFile: string): SessionView {
    const worktreePath = session.worktree?.worktreePath;
    const staysInWorktree = worktreePath !== undefined && (conversationFolder === worktreePath || conversationFolder.startsWith(`${worktreePath}/`));
    return { ...session, projectPath: conversationFolder, transcriptPath: conversationFile, worktree: staysInWorktree ? session.worktree : undefined };
  }

  // The process still holding the session's conversation, from Claude Code's records.
  static liveProcess(session: SessionView, records: Map<string, ClaudeSessionRecord> | undefined, processIsRunning: (pid: number) => boolean): number | undefined {
    if (session.agent !== "claude" || !session.agentSessionId || !records) return undefined;
    const record = records.get(session.agentSessionId);
    return record && processIsRunning(record.pid) ? record.pid : undefined;
  }

  // A background session (claude --bg, as claude-keep starts) belongs to Claude's daemon, which starts
  // it again after a signal; Claude's own stop command ends it for good. Others end with a signal.
  static stopCommand(record: ClaudeSessionRecord): { program: string; args: string[] } | undefined {
    return record.kind === "bg" ? { program: "claude", args: ["stop", record.sessionId] } : undefined;
  }
}
