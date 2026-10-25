// Every session HeyTerm knows, the hook events that change them, and their saved copy on disk.

import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";
import { AgentSessionMatch } from "./agent-session-match.ts";
import { ClaudeSessionStatus, type ClaudeSessionRecord } from "./claude-session-status.ts";
import { ExternalSessionNaming } from "./external-session-naming.ts";
import { AgentHookTranslator, type HookedAgentKind } from "../agents/agent-hook-translator.ts";
import { SessionLifecycle } from "./session-lifecycle.ts";
import type { StateStore } from "./state-store.ts";
import type { HeldHookRequests } from "../hooks/held-hook-requests.ts";
import type { HookEvent, HookEventName, SessionView } from "../../shared/types.ts";

const recentlyClosedLimit = 20;

export class SessionRegistry extends EventEmitter<{ changed: [] }> {
  private readonly sessions = new Map<string, SessionView>();
  private recentlyClosed: SessionView[] = [];
  private readonly promptWaiters = new Map<string, Set<() => void>>();
  private dayKey = localDayKey(Date.now());
  private changeTimer: NodeJS.Timeout | undefined;
  private saveTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly store: StateStore,
    private readonly heldRequests: HeldHookRequests,
  ) {
    super();
  }

  restore(sessions: SessionView[], recentlyClosed: SessionView[]): void {
    for (const session of sessions) this.sessions.set(session.name, session);
    this.recentlyClosed = recentlyClosed;
  }

  list(): SessionView[] {
    return [...this.sessions.values()].sort((left, right) => left.createdAt - right.createdAt);
  }

  get(name: string): SessionView | undefined {
    return this.sessions.get(name);
  }

  recentlyClosedSessions(): SessionView[] {
    return this.recentlyClosed;
  }

  add(session: SessionView): void {
    this.recentlyClosed = this.recentlyClosed.filter((closed) => closed.name !== session.name);
    this.set(session);
  }

  remove(name: string): void {
    const session = this.sessions.get(name);
    if (!session) return;
    this.sessions.delete(name);
    this.heldRequests.letGoAllFor(name);
    const closed: SessionView = { ...session, state: "stopped", pending: undefined };
    this.recentlyClosed = [closed, ...this.recentlyClosed].slice(0, recentlyClosedLimit);
    this.announceChange();
  }

  // A session that left while HeyTerm was away; it is not worth a "recently closed" row.
  forget(name: string): void {
    if (!this.sessions.delete(name)) return;
    this.heldRequests.letGoAllFor(name);
    this.announceChange();
  }

  update(name: string, change: (session: SessionView) => SessionView): SessionView | undefined {
    const session = this.sessions.get(name);
    if (!session) return undefined;
    const updated = change(session);
    this.set(updated);
    return updated;
  }

  // Returns what the hook script should print: a decision for a held request, otherwise nothing.
  async applyHookEvent(event: HookEvent): Promise<string> {
    this.resetWaitsOnNewDay(event.receivedAt);
    const before = this.sessions.get(event.sessionName);
    if (!before) return "";
    const requestId = event.name === "PermissionRequest" ? randomUUID() : undefined;
    const after = SessionLifecycle.apply(before, event, { requestId });
    this.set(after);
    if (before.pending && before.pending.requestId !== after.pending?.requestId) {
      this.heldRequests.letGoAllFor(event.sessionName, after.pending?.requestId);
    }
    if (event.name === "UserPromptSubmit") this.resolvePromptWaiters(event.sessionName);
    return requestId ? this.heldRequests.hold(requestId, event.sessionName) : "";
  }

  // An event from Grok Build or Cursor, which run HeyTerm's hooks from a global file in every session.
  // Only the sessions HeyTerm started move; the reply is what the hook prints.
  async applyAgentHookEvent(agent: HookedAgentKind, eventName: string, rawPayload: Record<string, unknown>, receivedAt: number): Promise<string> {
    const defaultReply = AgentHookTranslator.defaultReply(agent, eventName);
    const event = AgentHookTranslator.translate(agent, eventName, rawPayload);
    if (!event) return defaultReply;
    const found = AgentSessionMatch.find(this.list(), agent, event.agentSessionId, String(event.payload.cwd ?? ""));
    if (!found) return defaultReply;
    if (found.claimsId) this.set({ ...found.session, agentSessionId: event.agentSessionId });
    const answer = await this.applyHookEvent({ name: event.name, sessionName: found.session.name, payload: event.payload, receivedAt });
    return answer || defaultReply;
  }

  // Brings Claude sessions in line with Claude Code's own records: a stopped turn returns to idle,
  // and a session from the user's terminal whose Claude has gone is closed.
  reconcileClaudeSessions(records: Map<string, ClaudeSessionRecord>, processIsRunning: (pid: number) => boolean, now: number): void {
    for (const session of this.list()) {
      const record = session.agentSessionId ? records.get(session.agentSessionId) : undefined;
      const verdict = ClaudeSessionStatus.verdict(session, record, record ? processIsRunning(record.pid) : false, now);
      if (verdict === "turn_stopped") {
        this.heldRequests.letGoAllFor(session.name);
        this.update(session.name, (current) => SessionLifecycle.applyTurnStopped(current, now));
      }
      if (verdict === "ended") this.remove(session.name);
    }
  }

  // An event from a session the user started in their own terminal, known by its Claude session id.
  async applyExternalHookEvent(name: HookEventName, payload: Record<string, unknown>, receivedAt: number): Promise<string> {
    const agentSessionId = typeof payload.session_id === "string" ? payload.session_id : "";
    if (!agentSessionId) return "";
    let session = this.list().find((known) => known.origin === "external" && known.agentSessionId === agentSessionId);
    if (!session) {
      if (name === "SessionEnd") return "";
      session = this.newExternalSession(agentSessionId, payload, receivedAt);
      this.set(session);
    }
    const answer = await this.applyHookEvent({ name, sessionName: session.name, payload, receivedAt });
    if (name === "SessionEnd") this.remove(session.name);
    return answer;
  }

  private newExternalSession(agentSessionId: string, payload: Record<string, unknown>, now: number): SessionView {
    const workingDirectory = typeof payload.cwd === "string" ? payload.cwd : "";
    const sessionTitle = typeof payload.session_title === "string" ? payload.session_title : undefined;
    const name = ExternalSessionNaming.nameFor({ sessionTitle, workingDirectory }, [...this.sessions.keys()]);
    return {
      name,
      origin: "external",
      projectPath: workingDirectory,
      projectName: path.basename(workingDirectory) || name,
      agent: "claude",
      state: "idle",
      stateSince: now,
      createdAt: now,
      lastSeenAt: now,
      agentSessionId,
      activitySinceSeen: [],
      waitedMillisecondsToday: 0,
    };
  }

  // Resolves true once the session reports a submitted prompt, false after the timeout.
  waitForPromptSubmitted(name: string, timeoutMilliseconds: number): Promise<boolean> {
    return new Promise((resolve) => {
      const waiters = this.promptWaiters.get(name) ?? new Set();
      const onSubmitted = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        waiters.delete(onSubmitted);
        resolve(false);
      }, timeoutMilliseconds);
      waiters.add(onSubmitted);
      this.promptWaiters.set(name, waiters);
    });
  }

  private resolvePromptWaiters(name: string): void {
    const waiters = this.promptWaiters.get(name);
    if (!waiters) return;
    this.promptWaiters.delete(name);
    for (const waiter of waiters) waiter();
  }

  private set(session: SessionView): void {
    this.sessions.set(session.name, session);
    this.announceChange();
  }

  // Writes the saved copy now, for shutdown, instead of waiting for the next quiet moment.
  async saveNow(): Promise<void> {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    await this.store.save({ sessions: this.list(), recentlyClosed: this.recentlyClosed });
  }

  private resetWaitsOnNewDay(now: number): void {
    const today = localDayKey(now);
    if (today === this.dayKey) return;
    this.dayKey = today;
    for (const session of this.sessions.values()) this.sessions.set(session.name, { ...session, waitedMillisecondsToday: 0 });
  }

  // Many hook events arrive in a burst; tell listeners once per burst, and save less often still.
  private announceChange(): void {
    this.changeTimer ??= setTimeout(() => {
      this.changeTimer = undefined;
      this.emit("changed");
    }, 40);
    this.saveTimer ??= setTimeout(() => {
      this.saveTimer = undefined;
      this.store.save({ sessions: this.list(), recentlyClosed: this.recentlyClosed }).catch(() => undefined);
    }, 500);
  }
}


function localDayKey(time: number): string {
  return new Date(time).toDateString();
}
