// How each session state looks and reads, from one table so every view agrees.

import type { AgentKind, AttentionKind, SessionState, SessionView } from "../../shared/types.ts";

interface StateDisplay {
  label: string;
  // A Tailwind text color from the theme tokens.
  textClass: string;
  markClass: string;
  ringClass: string;
  needsYou: boolean;
}

export const stateDisplay: Record<SessionState, StateDisplay> = {
  starting: { label: "Starting", textClass: "text-ink-faint", markClass: "bg-idle", ringClass: "", needsYou: false },
  idle: { label: "Idle", textClass: "text-ink-faint", markClass: "bg-idle", ringClass: "", needsYou: false },
  working: { label: "Working", textClass: "text-working", markClass: "bg-working", ringClass: "", needsYou: false },
  needs_permission: { label: "Needs a permission", textClass: "text-permission", markClass: "bg-permission", ringClass: "ring-1 ring-permission/70", needsYou: true },
  asked: { label: "Asked you", textClass: "text-question", markClass: "bg-question", ringClass: "ring-1 ring-question/70", needsYou: true },
  needs_trust: { label: "Needs trust", textClass: "text-trust", markClass: "bg-trust", ringClass: "ring-1 ring-trust/70", needsYou: true },
  done: { label: "Done", textClass: "text-finished", markClass: "bg-finished", ringClass: "", needsYou: false },
  failed: { label: "Failed", textClass: "text-failed", markClass: "bg-failed", ringClass: "ring-1 ring-failed/60", needsYou: true },
  stopped: { label: "Stopped", textClass: "text-ink-faint", markClass: "bg-idle", ringClass: "", needsYou: false },
};

const waitingStates: SessionState[] = ["needs_permission", "asked", "needs_trust", "done", "failed"];

// The word beside a session's name saying what runs in it. Claude Code is the default and goes unsaid.
export function agentTag(agent: AgentKind): string | undefined {
  if (agent === "claude") return undefined;
  return agent === "shell" ? "terminal" : agent;
}

export function isWaitingOnUser(state: SessionState): boolean {
  return waitingStates.includes(state);
}

// What to say to a session's message. HeyTerm cannot type into a session in the user's own terminal.
export function messageVoiceHint(session: Pick<SessionView, "name" | "origin">, kind: AttentionKind): string {
  if (kind !== "question") return `Say go to ${session.name}, or catch me up`;
  return session.origin === "external" ? "Reply in your own terminal" : `Answer out loud, or say ${session.name} and your reply`;
}

// "45s", "4m", "1h 12m"
export function shortDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
