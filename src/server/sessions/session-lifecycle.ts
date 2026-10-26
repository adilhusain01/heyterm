// Turns Claude Code hook events into a session's state. Pure: every call returns a new session.

import path from "node:path";
import { PermissionRisk } from "../safety/permission-risk.ts";
import type { ActivityEntry, ActivityKind, AgentQuestion, HookEvent, SessionState, SessionView } from "../../shared/types.ts";

export interface LifecycleOptions {
  // Id for a request the hook is holding open; needed for PermissionRequest.
  requestId?: string;
}

const statesWaitingOnUser: SessionState[] = ["needs_permission", "asked", "needs_trust", "done", "failed"];

export class SessionLifecycle {
  static readonly maximumActivityEntries = 200;

  // Every event is also activity: it says when the session last did anything, clears a quiet
  // notice, and tracks the shell command running, if any (see quiet-rules.ts).
  static apply(original: SessionView, event: HookEvent, options: LifecycleOptions = {}): SessionView {
    const result = SessionLifecycle.applyEvent(original, event, options);
    return { ...result, lastActivityAt: event.receivedAt, quiet: undefined, runningCommand: runningCommandAfter(result, event) };
  }

  private static applyEvent(original: SessionView, event: HookEvent, options: LifecycleOptions): SessionView {
    // Any real event means the session moved past a dialog left open across a restart.
    const session = original.blockedByTerminalDialog && event.name !== "Notification" ? { ...original, blockedByTerminalDialog: undefined } : original;
    const payload = event.payload;
    switch (event.name) {
      case "SessionStart":
        return SessionLifecycle.moveTo({ ...session, agentSessionId: stringField(payload, "session_id") || session.agentSessionId, transcriptPath: stringField(payload, "transcript_path") || session.transcriptPath }, "idle", event.receivedAt);
      case "UserPromptSubmit": {
        const prompt = stringField(payload, "prompt");
        const withPrompt = SessionLifecycle.addActivity({ ...session, lastPrompt: prompt, pending: undefined, filesChangedInLastTask: [] }, "prompt", prompt, event.receivedAt);
        return SessionLifecycle.moveTo(withPrompt, "working", event.receivedAt);
      }
      case "PreToolUse":
        return SessionLifecycle.applyToolStart(session, event);
      case "PostToolUse":
        return SessionLifecycle.applyToolEnd(SessionLifecycle.withFileChanged(session, event), event);
      case "PermissionRequest":
        return SessionLifecycle.applyPermissionRequest(session, event, options.requestId ?? `request-${event.receivedAt}`);
      case "Stop":
        return SessionLifecycle.applyTurnEnd(session, event);
      case "StopFailure": {
        const errorText = stringField(payload, "error") || "the turn ended on an error";
        return SessionLifecycle.moveTo({ ...session, pending: undefined, lastMessage: errorText }, "failed", event.receivedAt);
      }
      case "SessionEnd":
        return SessionLifecycle.moveTo({ ...session, pending: undefined }, "stopped", event.receivedAt);
      case "Notification": {
        // Agents that report through translated hooks (see agent-hook-translator.ts) send two kinds:
        // a permission card the user answers in the agent's own terminal, and the agent's reply
        // ahead of the turn's end. For Claude Code, notifications repeat what other hooks said.
        if (payload.waits_in_terminal === true) return SessionLifecycle.moveTo({ ...session, blockedByTerminalDialog: true }, "asked", event.receivedAt);
        const reply = stringField(payload, "assistant_message");
        return reply ? { ...session, lastMessage: reply } : session;
      }
    }
  }

  static applyTrustDialog(session: SessionView, now: number, trustSubject: "folder" | "hooks" = "folder"): SessionView {
    return SessionLifecycle.moveTo({ ...session, trustSubject }, "needs_trust", now);
  }

  // Claude Code was stopped mid-turn (no Stop hook is sent for that) and waits at its prompt.
  static applyTurnStopped(session: SessionView, now: number): SessionView {
    return SessionLifecycle.moveTo({ ...session, pending: undefined, blockedByTerminalDialog: undefined }, "idle", now);
  }

  static markSeen(session: SessionView, now: number): SessionView {
    return { ...session, lastSeenAt: now, activitySinceSeen: [] };
  }

  static recordDecision(session: SessionView, text: string, now: number): SessionView {
    return SessionLifecycle.addActivity(session, "decision", text, now);
  }

  private static applyToolStart(session: SessionView, event: HookEvent): SessionView {
    const toolName = stringField(event.payload, "tool_name");
    const toolInput = recordField(event.payload, "tool_input");
    const activity = describeToolUse(toolName, toolInput, session.projectPath);
    const withActivity = activity ? SessionLifecycle.addActivity(session, activity.kind, activity.text, event.receivedAt) : session;
    if (withActivity.state === "working") return withActivity;
    return SessionLifecycle.moveTo(withActivity, "working", event.receivedAt);
  }

  // An edit that finished, so the file really changed (a denied one never gets here).
  private static withFileChanged(session: SessionView, event: HookEvent): SessionView {
    const change = describeToolUse(stringField(event.payload, "tool_name"), recordField(event.payload, "tool_input"), session.projectPath);
    if (change?.kind !== "file" || !change.text) return session;
    const files = session.filesChangedInLastTask ?? [];
    return files.includes(change.text) ? session : { ...session, filesChangedInLastTask: [...files, change.text] };
  }

  private static applyToolEnd(session: SessionView, event: HookEvent): SessionView {
    if (!session.pending) return session;
    const toolName = stringField(event.payload, "tool_name");
    const pendingToolName = session.pending.kind === "question" ? "AskUserQuestion" : session.pending.toolName;
    if (toolName !== pendingToolName) return session;
    // The request was settled, here or by hand in the terminal.
    return SessionLifecycle.moveTo({ ...session, pending: undefined }, "working", event.receivedAt);
  }

  private static applyPermissionRequest(session: SessionView, event: HookEvent, requestId: string): SessionView {
    const toolName = stringField(event.payload, "tool_name");
    const toolInput = recordField(event.payload, "tool_input");
    if (toolName === "AskUserQuestion") {
      const questions = Array.isArray(toolInput.questions) ? (toolInput.questions as AgentQuestion[]) : [];
      const pending = { kind: "question" as const, requestId, questions, toolInput, createdAt: event.receivedAt };
      return SessionLifecycle.moveTo({ ...session, pending }, "asked", event.receivedAt);
    }
    const assessment = PermissionRisk.assess({ toolName, toolInput, projectPath: session.projectPath });
    const pending = { kind: "permission" as const, requestId, toolName, toolInput, ...assessment, createdAt: event.receivedAt };
    return SessionLifecycle.moveTo({ ...session, pending }, "needs_permission", event.receivedAt);
  }

  private static applyTurnEnd(session: SessionView, event: HookEvent): SessionView {
    if (event.payload.turn_cancelled === true) return SessionLifecycle.moveTo({ ...session, pending: undefined }, "idle", event.receivedAt);
    const lastMessage = event.payload.keep_last_message === true ? (session.lastMessage ?? "") : stringField(event.payload, "last_assistant_message");
    const withMessage = SessionLifecycle.addActivity({ ...session, lastMessage, pending: undefined }, "message", lastMessage, event.receivedAt);
    return SessionLifecycle.moveTo(withMessage, endsWithQuestion(lastMessage) ? "asked" : "done", event.receivedAt);
  }

  // A permission or question is held open by the server that received it. After a restart nothing
  // holds it: the agent asked in its own terminal instead, so that is where it waits.
  static afterHeldRequestLost(session: SessionView, now: number): SessionView {
    if (!session.pending) return session;
    return SessionLifecycle.moveTo({ ...session, pending: undefined, blockedByTerminalDialog: true }, "asked", now);
  }

  private static moveTo(session: SessionView, state: SessionState, now: number): SessionView {
    const leavingWait = statesWaitingOnUser.includes(session.state) && !statesWaitingOnUser.includes(state);
    const waitedMillisecondsToday = leavingWait
      ? session.waitedMillisecondsToday + Math.max(0, now - session.stateSince)
      : session.waitedMillisecondsToday;
    return { ...session, state, stateSince: now, waitedMillisecondsToday };
  }

  private static addActivity(session: SessionView, kind: ActivityKind, text: string, at: number): SessionView {
    if (!text) return session;
    const entries: ActivityEntry[] = [...session.activitySinceSeen, { kind, text, at }];
    return { ...session, activitySinceSeen: entries.slice(-SessionLifecycle.maximumActivityEntries) };
  }
}

function runningCommandAfter(session: SessionView, event: HookEvent): SessionView["runningCommand"] {
  const toolName = stringField(event.payload, "tool_name");
  if (event.name === "PreToolUse" && toolName === "Bash") return { text: stringField(recordField(event.payload, "tool_input"), "command"), since: event.receivedAt };
  if (event.name === "PostToolUse" && toolName === "Bash") return undefined;
  if (["UserPromptSubmit", "Stop", "StopFailure", "SessionEnd"].includes(event.name)) return undefined;
  return session.runningCommand;
}

function describeToolUse(toolName: string, toolInput: Record<string, unknown>, projectPath: string): { kind: ActivityKind; text: string } | undefined {
  if (toolName === "Bash") return { kind: "tool", text: stringField(toolInput, "command") };
  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(toolName)) {
    const filePath = stringField(toolInput, "file_path") || stringField(toolInput, "notebook_path");
    const relativePath = path.relative(projectPath, filePath);
    return { kind: "file", text: relativePath.startsWith("..") ? filePath : relativePath.split(path.sep).join("/") };
  }
  if (toolName === "AskUserQuestion") return undefined;
  return { kind: "tool", text: toolName };
}

// A turn asks something when its last paragraph does; a question earlier on was rhetorical.
function endsWithQuestion(message: string): boolean {
  const paragraphs = message.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return paragraphs.at(-1)?.includes("?") ?? false;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function recordField(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
