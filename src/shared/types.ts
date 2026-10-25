// Types shared by the server and the web UI.

export type SessionState =
  | "starting"
  | "idle"
  | "working"
  | "needs_permission"
  | "asked"
  | "needs_trust"
  | "done"
  | "failed"
  | "stopped";

// "shell" is a plain terminal: the developer's login shell, with no agent and no hooks.
export type AgentKind = "claude" | "codex" | "gemini" | "grok" | "cursor" | "shell";

export type RiskLevel = "low" | "high";

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface AgentQuestion {
  question: string;
  header?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

export interface PendingPermission {
  kind: "permission";
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  // What a person reads or hears: the command, the file, the URL.
  summary: string;
  risk: RiskLevel;
  riskReasons: string[];
  createdAt: number;
}

export interface PendingQuestion {
  kind: "question";
  requestId: string;
  questions: AgentQuestion[];
  toolInput: Record<string, unknown>;
  createdAt: number;
}

export type PendingRequest = PendingPermission | PendingQuestion;

export type ActivityKind = "prompt" | "tool" | "file" | "message" | "decision";

export interface ActivityEntry {
  kind: ActivityKind;
  text: string;
  at: number;
}

// "heyterm": started by HeyTerm in its tmux, so HeyTerm can type into it.
// "external": started by the user in their own terminal and reported by the opt-in hooks.
export type SessionOrigin = "heyterm" | "external";

// A working session that has said nothing for long: quiet, or running one command for long.
export interface QuietNotice {
  kind: "quiet" | "long_command";
  since: number;
}

// A git worktree HeyTerm made for one session: a checkout of its own, on a branch of its own.
export interface SessionWorktree {
  repoPath: string;
  worktreePath: string;
  branch: string;
  baseCommit: string;
}

export interface SessionView {
  name: string;
  origin?: SessionOrigin;
  projectPath: string;
  projectName: string;
  agent: AgentKind;
  state: SessionState;
  stateSince: number;
  createdAt: number;
  lastSeenAt: number;
  lastPrompt?: string;
  lastMessage?: string;
  pending?: PendingRequest;
  // A dialog HeyTerm was holding when it restarted: it is on screen in the terminal, and typed text would land in it.
  blockedByTerminalDialog?: boolean;
  agentSessionId?: string;
  // Files the session's own edits touched since its last prompt, relative to its folder.
  filesChangedInLastTask?: string[];
  // When the session last sent any hook event, and the shell command it is running, if any.
  lastActivityAt?: number;
  runningCommand?: { text: string; since: number };
  // Set once a working session has gone quiet for long; any new activity clears it.
  quiet?: QuietNotice;
  // Set when the session works in its own git worktree, because another session used its folder.
  worktree?: SessionWorktree;
  // The name the session's face is drawn from: its first name, so a rename keeps the face.
  faceSeed?: string;
  // What a needs_trust session asks to trust: its folder, or (Codex) hooks it has not seen before.
  trustSubject?: "folder" | "hooks";
  // Where Claude saves this session's conversation; the file exists only once a message was sent.
  transcriptPath?: string;
  // Activity since the session was last looked at, newest last.
  activitySinceSeen: ActivityEntry[];
  // Time this session spent waiting on the user today, in milliseconds.
  waitedMillisecondsToday: number;
}

export type AttentionKind = "permission" | "question" | "trust" | "failed" | "finished" | "quiet";

export interface AttentionItem {
  sessionName: string;
  kind: AttentionKind;
  since: number;
  // What is shown on screen; may quote the command or the agent's words.
  headline: string;
  // What is said out loud: what the session wants and what to say back, never a command or code.
  spoken: string;
  requestId?: string;
}

export type HookEventName =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "PermissionRequest"
  | "Notification"
  | "Stop"
  | "StopFailure"
  | "SessionEnd";

export interface HookEvent {
  name: HookEventName;
  sessionName: string;
  payload: Record<string, unknown>;
  receivedAt: number;
}

export type AnnouncementMode = "speak" | "quiet" | "mute";

export type RouterAction =
  | { type: "send"; session: string; text: string; needsPreview: boolean }
  | { type: "answer"; session: string; requestId: string; answers: Record<string, string> }
  | { type: "approve"; session: string; requestId: string; confirmed: boolean }
  | { type: "deny"; session: string; requestId: string; reason?: string }
  | { type: "trust"; session: string }
  | { type: "interrupt"; session: string }
  | { type: "catch_up"; session?: string }
  | { type: "status"; session: string }
  | { type: "focus"; session: string }
  | { type: "spawn"; project: string; task?: string; agent?: AgentKind }
  | { type: "close"; session: string; confirmed: boolean }
  | { type: "resume"; session: string }
  | { type: "rename"; session: string; newName: string }
  | { type: "forget_closed"; session: string }
  | { type: "changes"; session: string }
  | { type: "adopt"; session: string; confirmed: boolean }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "send_now" }
  | { type: "mode"; mode: AnnouncementMode }
  | { type: "choose"; index: number }
  | { type: "clarify"; question: string; options: string[] }
  | { type: "unknown"; reason: string };

// What the router knows when it reads an utterance.
export interface RoutingContext {
  sessions: SessionView[];
  projectNames: string[];
  attentionHead?: AttentionItem;
  focusedSession?: string;
  hasPendingPreview: boolean;
  pendingClarifyOptions?: string[];
  recentlyClosedNames?: string[];
  // A yes or no is awaited: the assistant asked to do something, or a busy session is being closed.
  hasPendingConfirmation?: boolean;
}
