// Every session HeyTerm knows, the hook events that change them, and their saved copy on disk.

import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";
import { AgentSessionMatch } from "./agent-session-match.ts";
import { ClaudeSessionStatus, type ClaudeSessionRecord } from "./claude-session-status.ts";
import { SessionNames } from "../../shared/session-names.ts";
import { QuietRules } from "./quiet-rules.ts";
import { ExternalSessionNaming } from "./external-session-naming.ts";
import { AgentHookTranslator, type HookedAgentKind } from "../agents/agent-hook-translator.ts";
import { SessionLifecycle } from "./session-lifecycle.ts";
import type { StateStore } from "./state-store.ts";
import type { HeldHookRequests } from "../hooks/held-hook-requests.ts";
import type { HookEvent, HookEventName, SessionView } from "../../shared/types.ts";

// What the registry needs from TurnChangeTracker (turn-change-tracker.ts).
export interface TurnChangeTracking {
  taskStarted(session: SessionView): void | Promise<void>;
  filesChangedByTask(session: SessionView): Promise<string[]>;
}

const recentlyClosedLimit = 20;

export class SessionRegistry extends EventEmitter<{ changed: [] }> {
  private readonly sessions = new Map<string, SessionView>();
  private recentlyClosed: SessionView[] = [];
  // Sessions found in Claude Code's records whose state follows the record, by conversation id.
  private readonly followingRecords = new Set<string>();
  // Closed sessions another computer's HeyTerm reports, by that computer (remote-host-rules.ts).
  private readonly hostRecentlyClosed = new Map<string, SessionView[]>();
  private readonly promptWaiters = new Map<string, Set<() => void>>();
  private turnChangeTracker: TurnChangeTracking | undefined;
  // Launch name to current name, for renamed sessions HeyTerm started: their hooks keep the launch name.
  private readonly launchNames = new Map<string, string>();
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
    const now = Date.now();
    for (const session of sessions) this.sessions.set(session.name, SessionLifecycle.afterHeldRequestLost(session, now));
    // Older versions let closed sessions share a name; the newest keeps it, older ones get a number.
    const takenNames = new Set(this.sessions.keys());
    this.recentlyClosed = recentlyClosed.map((closed) => {
      const name = takenNames.has(closed.name) ? freeNameLike(closed.name, takenNames) : closed.name;
      takenNames.add(name);
      return name === closed.name ? closed : { ...closed, name };
    });
  }

  list(): SessionView[] {
    return [...this.sessions.values()].sort((left, right) => left.createdAt - right.createdAt);
  }

  get(name: string): SessionView | undefined {
    return this.sessions.get(name);
  }

  recentlyClosedSessions(): SessionView[] {
    return [...this.recentlyClosed, ...[...this.hostRecentlyClosed.values()].flat()];
  }

  // What another computer's HeyTerm reports, in place of what it reported before. Those sessions are
  // its to change; here they are only shown, and what is done to them is sent there.
  replaceHostSessions(host: string, sessions: SessionView[], recentlyClosed: SessionView[]): void {
    for (const session of this.list()) if (session.host === host) this.sessions.delete(session.name);
    for (const session of sessions) this.sessions.set(session.name, session);
    this.hostRecentlyClosed.set(host, recentlyClosed);
    this.announceChange();
  }

  // The connection to that computer dropped: its sessions stay listed, marked, until it reports again.
  markHostUnreachable(host: string): void {
    for (const session of this.list()) if (session.host === host) this.sessions.set(session.name, { ...session, hostUnreachable: true });
    this.announceChange();
  }

  // This computer's own sessions: the ones its hooks, records, folders and saved copy are about.
  localSessions(): SessionView[] {
    return this.list().filter((session) => !session.host);
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
    for (const [launchName, renamedTo] of this.launchNames) if (renamedTo === name) this.launchNames.delete(launchName);
    const closed: SessionView = { ...session, state: "stopped", stateSince: Date.now(), pending: undefined };
    this.recentlyClosed = [closed, ...this.recentlyClosed].slice(0, recentlyClosedLimit);
    this.announceChange();
  }

  // Takes a closed session off the list. Its conversation stays with the agent, which can still resume it.
  forgetClosed(name: string): boolean {
    const before = this.recentlyClosed.length;
    this.recentlyClosed = this.recentlyClosed.filter((closed) => closed.name !== name);
    if (this.recentlyClosed.length === before) return false;
    this.announceChange();
    return true;
  }

  // Without Claude Code's records nothing can say whether these are still running.
  forgetExternalSessions(): void {
    for (const session of this.localSessions()) if (session.origin === "external") this.forget(session.name);
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

  // Lets git say what a task changed, which edit hooks miss when a shell command does the editing.
  useTurnChangeTracker(tracker: TurnChangeTracking): void {
    this.turnChangeTracker = tracker;
  }

  // Returns what the hook script should print: a decision for a held request, otherwise nothing.
  async applyHookEvent(event: HookEvent): Promise<string> {
    this.resetWaitsOnNewDay(event.receivedAt);
    const routedName = this.currentName(event.sessionName, event.payload, event.name);
    if (routedName === undefined) return "";
    const sessionName = routedName;
    const before = this.sessions.get(sessionName);
    if (!before) return "";
    if (event.name === "UserPromptSubmit") void this.turnChangeTracker?.taskStarted(before);
    // Before the session shows as done, so the finished line already counts every changed file.
    const changedByTask = event.name === "Stop" && this.turnChangeTracker ? await this.turnChangeTracker.filesChangedByTask(before).catch(() => []) : [];
    const requestId = event.name === "PermissionRequest" ? randomUUID() : undefined;
    const lifecycleResult = SessionLifecycle.apply(this.sessions.get(sessionName) ?? before, event, { requestId });
    const after = changedByTask.length > 0 ? { ...lifecycleResult, filesChangedInLastTask: [...new Set([...(lifecycleResult.filesChangedInLastTask ?? []), ...changedByTask])] } : lifecycleResult;
    this.set(after);
    if (before.pending && before.pending.requestId !== after.pending?.requestId) {
      this.heldRequests.letGoAllFor(sessionName, after.pending?.requestId);
    }
    if (event.name === "UserPromptSubmit") this.resolvePromptWaiters(sessionName);
    return requestId ? this.heldRequests.hold(requestId, sessionName) : "";
  }

  // Renames an open or recently closed session; returns why it could not, or undefined.
  rename(currentName: string, newName: string): string | undefined {
    const live = this.sessions.get(currentName);
    const closedIndex = this.recentlyClosed.findIndex((closed) => closed.name === currentName);
    if (!live && closedIndex === -1) return `There is no session called ${currentName}.`;
    const ownLaunchNames = [...this.launchNames].filter(([, renamedTo]) => renamedTo === currentName).map(([launchName]) => launchName);
    const otherLaunchNames = this.reservedLaunchNames().filter((launchName) => !ownLaunchNames.includes(launchName));
    const takenNames = [...this.sessions.keys(), ...this.recentlyClosed.map((closed) => closed.name), ...otherLaunchNames];
    const problem = SessionNames.renameProblem(newName, currentName, takenNames);
    if (problem) return problem;
    if (live) {
      this.sessions.delete(currentName);
      this.sessions.set(newName, { ...live, name: newName, faceSeed: live.faceSeed ?? currentName });
      // A session HeyTerm started reports under its launch name for as long as it runs.
      this.launchNames.set(currentName, newName);
      for (const [launchName, renamedTo] of this.launchNames) if (renamedTo === currentName) this.launchNames.set(launchName, newName);
      this.heldRequests.renameSession(currentName, newName);
      const waiters = this.promptWaiters.get(currentName);
      if (waiters) {
        this.promptWaiters.delete(currentName);
        this.promptWaiters.set(newName, waiters);
      }
    } else {
      this.recentlyClosed = this.recentlyClosed.map((closed, index) => (index === closedIndex ? { ...closed, name: newName, faceSeed: closed.faceSeed ?? currentName } : closed));
    }
    this.announceChange();
    return undefined;
  }

  // The first free name of its kind among open sessions. A closed session holding it moves to the next
  // free number, so names stay unique and a new session does not skip past every closed one.
  nameForNewSession(base: string): string {
    const heldByOpenSessions = new Set([...this.sessions.keys(), ...this.reservedLaunchNames()]);
    const name = freeName(base, heldByOpenSessions);
    const closedIndex = this.recentlyClosed.findIndex((closed) => closed.name === name);
    if (closedIndex !== -1) {
      const closed = this.recentlyClosed[closedIndex]!;
      const newClosedName = freeName(base, new Set([...heldByOpenSessions, ...this.recentlyClosed.map((other) => other.name)]));
      this.recentlyClosed[closedIndex] = { ...closed, name: newClosedName, faceSeed: closed.faceSeed ?? closed.name };
    }
    return name;
  }

  // Taken by an open or listed closed session, or kept for a renamed one HeyTerm cannot yet tell apart by id.
  isNameInUse(name: string): boolean {
    return this.sessions.has(name) || this.reservedLaunchNames().includes(name) || this.recentlyClosed.some((closed) => closed.name === name);
  }

  // A renamed session's terminal keeps reporting under its launch name. Its events carry its
  // conversation id, so they are matched by that id first; the old name is then free for another
  // session. Only a session with no id yet keeps its launch name reserved.
  // An event whose id belongs to another conversation than the named session's is not that session's
  // (a closed session's last words under a name a new session now holds) and goes nowhere. A
  // SessionStart may bring a new id, as after /clear, so it still goes by name.
  private currentName(reportedName: string, payload: Record<string, unknown>, eventName: HookEventName): string | undefined {
    const conversationId = typeof payload.session_id === "string" ? payload.session_id : "";
    const byConversation = conversationId ? this.localSessions().find((session) => session.origin !== "external" && session.agentSessionId === conversationId) : undefined;
    if (byConversation) return byConversation.name;
    const named = this.sessions.has(reportedName) ? reportedName : (this.launchNames.get(reportedName) ?? reportedName);
    const namedId = this.sessions.get(named)?.agentSessionId;
    if (conversationId && namedId && namedId !== conversationId && eventName !== "SessionStart") return undefined;
    return named;
  }

  private reservedLaunchNames(): string[] {
    return [...this.launchNames].filter(([, renamedTo]) => !this.sessions.get(renamedTo)?.agentSessionId).map(([launchName]) => launchName);
  }

  // An event from Grok Build or Cursor, which run HeyTerm's hooks from a global file in every session.
  // Only the sessions HeyTerm started move; the reply is what the hook prints.
  async applyAgentHookEvent(agent: HookedAgentKind, eventName: string, rawPayload: Record<string, unknown>, receivedAt: number): Promise<string> {
    const defaultReply = AgentHookTranslator.defaultReply(agent, eventName);
    const event = AgentHookTranslator.translate(agent, eventName, rawPayload);
    if (!event) return defaultReply;
    const found = AgentSessionMatch.find(this.localSessions(), agent, event.agentSessionId, String(event.payload.cwd ?? ""));
    if (!found) return defaultReply;
    if (found.claimsId) this.set({ ...found.session, agentSessionId: event.agentSessionId });
    const answer = await this.applyHookEvent({ name: event.name, sessionName: found.session.name, payload: event.payload, receivedAt });
    return answer || defaultReply;
  }

  // Marks working sessions that have said nothing for long (quiet-rules.ts); each is told once.
  noticeQuietSessions(now: number): void {
    for (const session of this.localSessions()) {
      const quiet = QuietRules.verdict(session, now);
      if (quiet) this.update(session.name, (current) => ({ ...current, quiet }));
    }
  }

  // Brings Claude sessions in line with Claude Code's own records: a stopped turn returns to idle,
  // and a session from the user's terminal whose Claude has gone is closed.
  reconcileClaudeSessions(records: Map<string, ClaudeSessionRecord>, processIsRunning: (pid: number) => boolean, now: number): void {
    for (const session of this.localSessions()) {
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
  // Running Claude sessions that only Claude Code's records know about join as the developer's own,
  // in the state their record shows, and follow it until their own hooks report.
  discoverOutsideSessions(records: Iterable<ClaudeSessionRecord>, processIsRunning: (pid: number) => boolean, ignoredSessionIds: string[], now: number): void {
    const recordList = [...records];
    const knownSessionIds = new Set([...this.localSessions().map((known) => known.agentSessionId).filter((id): id is string => Boolean(id)), ...ignoredSessionIds]);
    let changed = false;
    for (const record of ClaudeSessionStatus.undiscovered(recordList, knownSessionIds, processIsRunning, now)) {
      const shownName = ClaudeSessionStatus.shownName(record);
      const state = ClaudeSessionStatus.stateFromStatus(record.status);
      const found = this.newExternalSession(record.sessionId, { cwd: record.cwd, ...(shownName ? { session_title: shownName } : {}) }, now);
      this.sessions.set(found.name, { ...found, state, ...(state === "asked" ? { blockedByTerminalDialog: true } : {}) });
      this.followingRecords.add(record.sessionId);
      changed = true;
    }
    for (const record of recordList) {
      if (!this.followingRecords.has(record.sessionId)) continue;
      const known = this.localSessions().find((session) => session.agentSessionId === record.sessionId);
      const state = ClaudeSessionStatus.stateFromStatus(record.status);
      if (!known || known.state === state) continue;
      this.sessions.set(known.name, { ...known, state, stateSince: now, blockedByTerminalDialog: state === "asked" ? true : undefined });
      changed = true;
    }
    if (changed) this.announceChange();
  }

  async applyExternalHookEvent(name: HookEventName, payload: Record<string, unknown>, receivedAt: number): Promise<string> {
    const agentSessionId = typeof payload.session_id === "string" ? payload.session_id : "";
    if (!agentSessionId) return "";
    // Its hooks report now, so its record no longer decides its state.
    this.followingRecords.delete(agentSessionId);
    let session = this.localSessions().find((known) => (known.origin === "external" || known.claudeInside) && known.agentSessionId === agentSessionId);
    if (!session) {
      if (name === "SessionEnd") return "";
      session = this.newExternalSession(agentSessionId, payload, receivedAt);
      this.set(session);
    }
    const answer = await this.applyHookEvent({ name, sessionName: session.name, payload, receivedAt });
    if (name === "SessionEnd") {
      // A Claude that ran in one of HeyTerm's terminals ends; the terminal goes on.
      if (session.claudeInside) this.unlinkFromTerminal(session.name, receivedAt);
      else this.remove(session.name);
    }
    return answer;
  }

  // A Claude found running in one of HeyTerm's terminals becomes that terminal's: the session it was
  // listed as goes (not to Recently closed), and its state and any held request move to the terminal.
  linkIntoTerminal(terminalName: string, agentSessionId: string, now: number): void {
    const terminal = this.sessions.get(terminalName);
    if (!terminal || terminal.agent !== "shell") return;
    if (terminal.claudeInside && terminal.agentSessionId === agentSessionId) return;
    const listedApart = this.localSessions().find((known) => known.origin === "external" && known.agentSessionId === agentSessionId);
    if (listedApart) {
      this.sessions.delete(listedApart.name);
      this.heldRequests.renameSession(listedApart.name, terminalName);
    }
    this.sessions.set(terminalName, {
      ...terminal,
      agentSessionId,
      claudeInside: true,
      state: listedApart?.state ?? "idle",
      stateSince: now,
      pending: listedApart?.pending,
      blockedByTerminalDialog: listedApart?.blockedByTerminalDialog,
      ...(listedApart?.lastPrompt ? { lastPrompt: listedApart.lastPrompt } : {}),
      ...(listedApart?.lastMessage ? { lastMessage: listedApart.lastMessage } : {}),
    });
    this.announceChange();
  }

  // The Claude in a terminal ended: the terminal is a plain shell again.
  unlinkFromTerminal(terminalName: string, now: number): void {
    const terminal = this.sessions.get(terminalName);
    if (!terminal?.claudeInside) return;
    this.heldRequests.letGoAllFor(terminalName);
    if (terminal.agentSessionId) this.followingRecords.delete(terminal.agentSessionId);
    this.sessions.set(terminalName, { ...terminal, agentSessionId: undefined, claudeInside: undefined, pending: undefined, blockedByTerminalDialog: undefined, state: "idle", stateSince: now });
    this.announceChange();
  }

  private newExternalSession(agentSessionId: string, payload: Record<string, unknown>, now: number): SessionView {
    const workingDirectory = typeof payload.cwd === "string" ? payload.cwd : "";
    const sessionTitle = typeof payload.session_title === "string" ? payload.session_title : undefined;
    // A conversation listed before comes back under the name it had, and leaves Recently closed.
    const listedBefore = this.recentlyClosed.find((closed) => closed.agentSessionId === agentSessionId && !this.sessions.has(closed.name));
    if (listedBefore) this.recentlyClosed = this.recentlyClosed.filter((closed) => closed !== listedBefore);
    const name = listedBefore?.name ?? this.nameForNewSession(ExternalSessionNaming.nameFor({ sessionTitle, workingDirectory }, []));
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
    await this.store.save({ sessions: this.localSessions(), recentlyClosed: this.recentlyClosed });
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
      this.store.save({ sessions: this.localSessions(), recentlyClosed: this.recentlyClosed }).catch(() => undefined);
    }, 500);
  }
}


function localDayKey(time: number): string {
  return new Date(time).toDateString();
}

function freeName(base: string, takenNames: Set<string>): string {
  return takenNames.has(base) ? freeNameLike(base, takenNames) : base;
}

function freeNameLike(name: string, takenNames: Set<string>): string {
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${name}-${suffix}`;
    if (!takenNames.has(candidate)) return candidate;
  }
}
