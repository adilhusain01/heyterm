import { describe, expect, it } from "vitest";
import { SessionRegistry } from "./session-registry.ts";
import type { HeldHookRequests } from "../hooks/held-hook-requests.ts";
import type { StateStore } from "./state-store.ts";
import type { ClaudeSessionRecord } from "./claude-session-status.ts";
import type { SessionView } from "../../shared/types.ts";

function makeRegistry(): SessionRegistry {
  const store = { save: async () => undefined } as unknown as StateStore;
  const held = { letGoAllFor: () => undefined, renameSession: () => undefined, hold: async () => "" } as unknown as HeldHookRequests;
  return new SessionRegistry(store, held);
}

function session(name: string, overrides: Partial<SessionView>): SessionView {
  return { name, projectPath: `/p/${name}`, projectName: name, agent: "grok", state: "starting", stateSince: 0, createdAt: 0, lastSeenAt: 0, activitySinceSeen: [], waitedMillisecondsToday: 0, ...overrides };
}

describe("SessionRegistry.applyAgentHookEvent", () => {
  it("moves a Grok session HeyTerm started by the id it was given", async () => {
    const registry = makeRegistry();
    registry.add(session("api", { agentSessionId: "grok-1" }));
    await registry.applyAgentHookEvent("grok", "UserPromptSubmit", { session_id: "grok-1", cwd: "/p/api", prompt: "fix it" }, 10);
    expect(registry.get("api")).toMatchObject({ state: "working", lastPrompt: "fix it" });
  });

  it("claims a Cursor conversation for the session it just started, then follows it", async () => {
    const registry = makeRegistry();
    registry.add(session("web", { agent: "cursor", projectPath: "/p/web" }));
    await registry.applyAgentHookEvent("cursor", "sessionStart", { conversation_id: "chat-1", session_id: "chat-1", workspace_roots: ["/p/web"] }, 10);
    expect(registry.get("web")).toMatchObject({ agentSessionId: "chat-1", state: "idle" });
  });

  it("ignores the user's own Grok and Cursor sessions", async () => {
    const registry = makeRegistry();
    registry.add(session("api", { agentSessionId: "grok-1" }));
    await registry.applyAgentHookEvent("grok", "UserPromptSubmit", { session_id: "someone-else", cwd: "/p/elsewhere", prompt: "x" }, 10);
    expect(registry.get("api")?.state).toBe("starting");
    expect(registry.list()).toHaveLength(1);
  });

  it("answers Cursor's prompt hook with a go-ahead whatever happens", async () => {
    const registry = makeRegistry();
    expect(await registry.applyAgentHookEvent("cursor", "beforeSubmitPrompt", { conversation_id: "nobody", workspace_roots: ["/p/x"], prompt: "x" }, 10)).toBe('{"continue":true}');
  });
});

describe("SessionRegistry.reconcileClaudeSessions", () => {
  const minute = 60_000;

  it("moves a stopped turn back to idle and closes a session whose Claude has gone", () => {
    const registry = makeRegistry();
    registry.add(session("synqed", { origin: "external", agent: "claude", agentSessionId: "a", state: "working", stateSince: 10 * minute }));
    registry.add(session("synqed-3", { origin: "external", agent: "claude", agentSessionId: "b", state: "idle", stateSince: 10 * minute }));
    const records = new Map([["a", { pid: 8515, sessionId: "a", status: "shell", statusUpdatedAt: 12 * minute }]]);
    registry.reconcileClaudeSessions(records, (pid) => pid === 8515, 13 * minute);
    expect(registry.get("synqed")).toMatchObject({ state: "idle", stateSince: 13 * minute });
    expect(registry.get("synqed-3")).toBeUndefined();
    expect(registry.recentlyClosedSessions().map((closed) => closed.name)).toContain("synqed-3");
  });
});

describe("SessionRegistry.rename", () => {
  it("renames a running session and keeps its hooks landing on it", async () => {
    const registry = makeRegistry();
    registry.add(session("synqed", { origin: "heyterm", agent: "claude", state: "idle" }));
    expect(registry.rename("synqed", "synqed-auth")).toBeUndefined();
    expect(registry.get("synqed")).toBeUndefined();
    expect(registry.get("synqed-auth")).toMatchObject({ name: "synqed-auth", state: "idle" });
    // A session HeyTerm started keeps reporting under the name it was launched with.
    await registry.applyHookEvent({ name: "UserPromptSubmit", sessionName: "synqed", payload: { prompt: "go" }, receivedAt: 5 });
    expect(registry.get("synqed-auth")).toMatchObject({ state: "working", lastPrompt: "go" });
    expect(registry.get("synqed")).toBeUndefined();
  });

  it("keeps the face a session had before it was renamed, open or closed, however often", () => {
    const registry = makeRegistry();
    registry.add(session("synqed", { agent: "claude" }));
    registry.rename("synqed", "synqed-auth");
    registry.rename("synqed-auth", "login");
    expect(registry.get("login")?.faceSeed).toBe("synqed");
    registry.remove("login");
    registry.rename("login", "login-old");
    expect(registry.recentlyClosedSessions()[0]?.faceSeed).toBe("synqed");
  });

  it("renames a closed session, so it comes back under the new name", () => {
    const registry = makeRegistry();
    registry.add(session("mine", { agent: "claude" }));
    registry.remove("mine");
    expect(registry.rename("mine", "heyterm-landing")).toBeUndefined();
    expect(registry.recentlyClosedSessions().map((closed) => closed.name)).toEqual(["heyterm-landing"]);
  });

  it("refuses a name another session has, open or closed", () => {
    const registry = makeRegistry();
    registry.add(session("synqed", { agent: "claude" }));
    registry.add(session("mine", { agent: "claude" }));
    registry.remove("mine");
    expect(registry.rename("synqed", "mine")).toBe("There is already a session called mine.");
    expect(registry.get("synqed")).toBeDefined();
  });

  it("keeps a renamed session's launch name taken while it is listed, so no new session gets its hooks", () => {
    const registry = makeRegistry();
    registry.add(session("synqed", { origin: "heyterm", agent: "claude" }));
    registry.rename("synqed", "synqed-auth");
    expect(registry.isNameInUse("synqed")).toBe(true);
    expect(registry.rename("synqed-auth", "synqed")).toBeUndefined();
    registry.remove("synqed");
    // Closed sessions keep their names too, so "bring back synqed" means one session.
    expect(registry.isNameInUse("synqed")).toBe(true);
    registry.forgetClosed("synqed");
    expect(registry.isNameInUse("synqed")).toBe(false);
  });

  it("says so when there is no such session", () => {
    expect(makeRegistry().rename("ghost", "spirit")).toBe("There is no session called ghost.");
  });
});

describe("SessionRegistry.forgetClosed", () => {
  it("takes a closed session off the list and leaves open ones alone", () => {
    const registry = makeRegistry();
    registry.add(session("mine", { agent: "claude" }));
    registry.remove("mine");
    registry.add(session("synqed", { agent: "claude" }));
    expect(registry.forgetClosed("mine")).toBe(true);
    expect(registry.recentlyClosedSessions()).toEqual([]);
    expect(registry.forgetClosed("synqed")).toBe(false);
    expect(registry.get("synqed")).toBeDefined();
  });

  it("dates a closed session by when it closed", () => {
    const registry = makeRegistry();
    registry.add(session("mine", { agent: "claude", stateSince: 5 }));
    const before = Date.now();
    registry.remove("mine");
    expect(registry.recentlyClosedSessions()[0]!.stateSince).toBeGreaterThanOrEqual(before);
  });
});

describe("Session names stay unique across open and closed sessions", () => {
  // Seen on 25 October 2026: eight closed sessions were all called "mine".
  it("tells apart closed sessions saved under one name, newest keeping it", () => {
    const registry = makeRegistry();
    registry.restore([session("mine", { agent: "claude" })], [session("mine", { agent: "claude", agentSessionId: "a" }), session("mine", { agent: "claude", agentSessionId: "b" }), session("web", { agent: "claude" })]);
    expect(registry.get("mine")).toBeDefined();
    expect(registry.recentlyClosedSessions().map((closed) => [closed.name, closed.agentSessionId])).toEqual([
      ["mine-2", "a"],
      ["mine-3", "b"],
      ["web", undefined],
    ]);
  });

  it("names a new session from the user's terminal apart from closed ones", async () => {
    const registry = makeRegistry();
    registry.restore([], [session("mine", { agent: "claude", agentSessionId: "old" })]);
    await registry.applyExternalHookEvent("SessionStart", { session_id: "new", cwd: "/Users/adil/Projects/mine" }, 10);
    expect(registry.list().map((open) => open.name)).toEqual(["mine-2"]);
  });

  it("counts a closed session's name as taken for new sessions", () => {
    const registry = makeRegistry();
    registry.add(session("api", { agent: "claude" }));
    registry.remove("api");
    expect(registry.isNameInUse("api")).toBe(true);
  });
});

describe("SessionRegistry.forgetExternalSessions", () => {
  it("drops sessions from the user's own terminal, which nothing can check, and keeps HeyTerm's", () => {
    const registry = makeRegistry();
    registry.add(session("synqed-auth", { origin: "external", agent: "claude" }));
    registry.add(session("api", { origin: "heyterm", agent: "claude" }));
    registry.forgetExternalSessions();
    expect(registry.list().map((open) => open.name)).toEqual(["api"]);
    expect(registry.recentlyClosedSessions()).toEqual([]);
  });
});

describe("SessionRegistry with a task change tracker", () => {
  it("snapshots the folder when a task starts and adds what git saw changed when it ends", async () => {
    const registry = makeRegistry();
    const started: string[] = [];
    registry.useTurnChangeTracker({
      taskStarted: (current) => void started.push(current.name),
      filesChangedByTask: async () => ["notes.txt", "todo.md"],
    });
    registry.add(session("hello", { origin: "heyterm", agent: "claude", state: "idle", projectPath: "/p/hello" }));
    await registry.applyHookEvent({ name: "UserPromptSubmit", sessionName: "hello", payload: { prompt: "append bye" }, receivedAt: 1 });
    await registry.applyHookEvent({ name: "PostToolUse", sessionName: "hello", payload: { tool_name: "Edit", tool_input: { file_path: "/p/hello/notes.txt" } }, receivedAt: 2 });
    await registry.applyHookEvent({ name: "Stop", sessionName: "hello", payload: { last_assistant_message: "Done." }, receivedAt: 3 });
    expect(started).toEqual(["hello"]);
    expect(registry.get("hello")).toMatchObject({ state: "done", filesChangedInLastTask: ["notes.txt", "todo.md"] });
  });
});

describe("SessionRegistry.noticeQuietSessions", () => {
  it("marks a working session that has said nothing for five minutes, once", () => {
    const registry = makeRegistry();
    registry.add(session("api", { agent: "claude", state: "working", lastActivityAt: 0 }));
    registry.add(session("web", { agent: "claude", state: "working", lastActivityAt: 4 * 60_000 }));
    registry.noticeQuietSessions(5 * 60_000);
    expect(registry.get("api")?.quiet).toEqual({ kind: "quiet", since: 0 });
    expect(registry.get("web")?.quiet).toBeUndefined();
  });
});

describe("SessionRegistry, a freed name after a rename", () => {
  // Adil, 25 October 2026: renamed "whisker" to "heyterm", then could not rename "whisker-2" to "whisker".
  it("frees the old name of a renamed session it knows by id, so another session can take it", () => {
    const registry = makeRegistry();
    registry.add(session("whisker", { origin: "heyterm", agent: "claude", agentSessionId: "conversation-a" }));
    registry.add(session("whisker-2", { agent: "claude" }));
    registry.remove("whisker-2");
    expect(registry.rename("whisker", "heyterm")).toBeUndefined();
    expect(registry.isNameInUse("whisker")).toBe(false);
    expect(registry.rename("whisker-2", "whisker")).toBeUndefined();
    expect(registry.recentlyClosedSessions().map((closed) => closed.name)).toContain("whisker");
  });

  // Its terminal still reports under the launch name, so its events are matched by conversation id.
  it("still brings the renamed session its own events when a new session holds the old name", async () => {
    const registry = makeRegistry();
    registry.add(session("whisker", { origin: "heyterm", agent: "claude", state: "idle", agentSessionId: "conversation-a" }));
    registry.rename("whisker", "heyterm");
    registry.add(session("whisker", { origin: "heyterm", agent: "claude", state: "idle", agentSessionId: "conversation-b" }));
    await registry.applyHookEvent({ name: "UserPromptSubmit", sessionName: "whisker", payload: { session_id: "conversation-a", prompt: "for heyterm" }, receivedAt: 5 });
    expect(registry.get("heyterm")).toMatchObject({ state: "working", lastPrompt: "for heyterm" });
    expect(registry.get("whisker")).toMatchObject({ state: "idle" });
    await registry.applyHookEvent({ name: "UserPromptSubmit", sessionName: "whisker", payload: { session_id: "conversation-b", prompt: "for the new whisker" }, receivedAt: 6 });
    expect(registry.get("whisker")).toMatchObject({ state: "working", lastPrompt: "for the new whisker" });
  });
});

describe("SessionRegistry, events from a session after it closed", () => {
  // Seen live on 25 October 2026: closing renamed "greeting" made its Claude send SessionEnd under its
  // launch name "hello", and the new session called hello was marked stopped.
  it("drops an event whose conversation id belongs to no open session, instead of giving it to the session now holding that name", async () => {
    const registry = makeRegistry();
    registry.add(session("hello", { origin: "heyterm", agent: "claude", state: "idle", agentSessionId: "conversation-a" }));
    registry.rename("hello", "greeting");
    registry.add(session("hello", { origin: "heyterm", agent: "claude", state: "idle", agentSessionId: "conversation-b" }));
    registry.remove("greeting");
    await registry.applyHookEvent({ name: "SessionEnd", sessionName: "hello", payload: { session_id: "conversation-a" }, receivedAt: 9 });
    expect(registry.get("hello")).toMatchObject({ state: "idle" });
  });
});

describe("SessionRegistry with sessions from another computer", () => {
  const minute = 60_000;
  const mirrored = (name: string, overrides: Partial<SessionView> = {}) => session(`vps/${name}`, { agent: "claude", host: "vps", origin: "heyterm", ...overrides });

  // The VPS's HeyTerm owns these; this one shows what it reports (26 October 2026).
  it("lists another computer's sessions beside its own, and replaces them on each report", () => {
    const registry = makeRegistry();
    registry.add(session("whisker", { agent: "claude" }));
    registry.replaceHostSessions("vps", [mirrored("voice-sticky"), mirrored("notes")], []);
    registry.replaceHostSessions("vps", [mirrored("voice-sticky", { state: "working" })], [mirrored("notes", { state: "stopped" })]);
    expect(registry.list().map((known) => known.name)).toEqual(["whisker", "vps/voice-sticky"]);
    expect(registry.get("vps/voice-sticky")?.state).toBe("working");
    expect(registry.recentlyClosedSessions().map((closed) => closed.name)).toEqual(["vps/notes"]);
  });

  it("never saves them, since the other computer keeps them", async () => {
    let saved: { sessions: SessionView[]; recentlyClosed: SessionView[] } | undefined;
    const store = { save: async (state: { sessions: SessionView[]; recentlyClosed: SessionView[] }) => void (saved = state) } as unknown as StateStore;
    const registry = new SessionRegistry(store, { letGoAllFor: () => undefined } as unknown as HeldHookRequests);
    registry.add(session("whisker", { agent: "claude" }));
    registry.replaceHostSessions("vps", [mirrored("voice-sticky")], [mirrored("notes", { state: "stopped" })]);
    await registry.saveNow();
    expect(saved?.sessions.map((known) => known.name)).toEqual(["whisker"]);
    expect(saved?.recentlyClosed).toEqual([]);
  });

  // This Mac has no Claude records for the VPS's sessions; checking them here would close them all.
  it("leaves them out of the checks only this computer can make", () => {
    const registry = makeRegistry();
    registry.replaceHostSessions("vps", [mirrored("own-terminal", { origin: "external", agentSessionId: "dec22d69", state: "idle", stateSince: 0 }), mirrored("busy", { state: "working", lastActivityAt: 0 })], []);
    registry.reconcileClaudeSessions(new Map(), () => false, 60 * minute);
    registry.noticeQuietSessions(60 * minute);
    registry.forgetExternalSessions();
    expect(registry.list().map((known) => known.name)).toEqual(["vps/own-terminal", "vps/busy"]);
    expect(registry.get("vps/busy")?.quiet).toBeUndefined();
  });

  // A dropped connection to the VPS (26 October 2026) left vps/voice-sticky saying Working for good.
  it("marks a computer's sessions as unreachable while its connection is down, until it reports again", () => {
    const registry = makeRegistry();
    registry.add(session("whisker", { agent: "claude" }));
    registry.replaceHostSessions("vps", [mirrored("voice-sticky", { state: "working" })], []);
    registry.markHostUnreachable("vps");
    expect(registry.get("vps/voice-sticky")).toMatchObject({ state: "working", hostUnreachable: true });
    expect(registry.get("whisker")?.hostUnreachable).toBeUndefined();
    registry.replaceHostSessions("vps", [mirrored("voice-sticky", { state: "idle" })], []);
    expect(registry.get("vps/voice-sticky")?.hostUnreachable).toBeUndefined();
  });
});

describe("SessionRegistry.restore after the server restarted", () => {
  // Seen on 26 October 2026: a permission held when HeyTerm restarted still showed Approve, which
  // answered nothing, because the held request ended with the old server and Claude asked in its terminal.
  it("shows a request the old server was holding as waiting in the session's terminal", () => {
    const registry = makeRegistry();
    const pending = { kind: "permission" as const, requestId: "r1", toolName: "Bash", toolInput: {}, summary: "npm test", risk: "low" as const, riskReasons: [], createdAt: 0 };
    registry.restore([session("whisker", { agent: "claude", state: "needs_permission", pending }), session("synqed", { agent: "claude", state: "working" })], []);
    expect(registry.get("whisker")).toMatchObject({ state: "asked", blockedByTerminalDialog: true });
    expect(registry.get("whisker")?.pending).toBeUndefined();
    expect(registry.get("synqed")).toMatchObject({ state: "working" });
    expect(registry.get("synqed")?.blockedByTerminalDialog).toBeUndefined();
  });
});

describe("SessionRegistry.discoverOutsideSessions", () => {
  const running = (overrides: Partial<ClaudeSessionRecord>): ClaudeSessionRecord => ({ pid: 1, sessionId: "7afa1836-aaaa", status: "busy", entrypoint: "cli", kind: "bg", cwd: "/root/Projects", ...overrides });

  it("lists a running Claude session found only in its record, as one of the developer's own", () => {
    const registry = makeRegistry();
    registry.discoverOutsideSessions([running({ name: "kernel-cve-patch", nameSource: "user" }), running({ sessionId: "94dc5feb-bbbb", name: "94dc5feb", status: "idle" })], () => true, [], 1_000);
    expect(registry.list().map((known) => [known.name, known.origin, known.state, known.agentSessionId])).toEqual([
      ["kernel-cve-patch", "external", "working", "7afa1836-aaaa"],
      ["projects", "external", "idle", "94dc5feb-bbbb"],
    ]);
  });

  it("leaves out sessions it already knows and the ones it is told to ignore", () => {
    const registry = makeRegistry();
    registry.add(session("whisker", { agent: "claude", agentSessionId: "8fd9f8e2" }));
    registry.discoverOutsideSessions([running({ sessionId: "8fd9f8e2" }), running({ sessionId: "assistant-id" })], () => true, ["assistant-id"], 1_000);
    expect(registry.list().map((known) => known.name)).toEqual(["whisker"]);
  });

  it("follows the record's status until the session's own hooks report", async () => {
    const registry = makeRegistry();
    registry.discoverOutsideSessions([running({ status: "busy" })], () => true, [], 1_000);
    const name = registry.list()[0]!.name;
    registry.discoverOutsideSessions([running({ status: "idle" })], () => true, [], 2_000);
    expect(registry.get(name)?.state).toBe("idle");
    await registry.applyExternalHookEvent("UserPromptSubmit", { session_id: "7afa1836-aaaa", cwd: "/root/Projects", prompt: "go on" }, 3_000);
    expect(registry.get(name)?.state).toBe("working");
    registry.discoverOutsideSessions([running({ status: "idle" })], () => true, [], 4_000);
    expect(registry.get(name)?.state).toBe("working");
  });
});

describe("SessionRegistry with a Claude inside one of HeyTerm's terminals", () => {
  it("shows the Claude's state and requests on the terminal, not as a second session", async () => {
    const registry = makeRegistry();
    registry.add(session("web-terminal", { agent: "shell", state: "idle", origin: "heyterm" }));
    await registry.applyExternalHookEvent("UserPromptSubmit", { session_id: "4450a7ab", cwd: "/p/web", prompt: "fix it" }, 1_000);
    registry.linkIntoTerminal("web-terminal", "4450a7ab", 2_000);
    expect(registry.list().map((known) => known.name)).toEqual(["web-terminal"]);
    expect(registry.recentlyClosedSessions()).toEqual([]);
    expect(registry.get("web-terminal")).toMatchObject({ agent: "shell", state: "working", agentSessionId: "4450a7ab", claudeInside: true });
    // Held open until answered, as the real hook is; the state shows while it waits.
    void registry.applyExternalHookEvent("PermissionRequest", { session_id: "4450a7ab", cwd: "/p/web", tool_name: "Bash", tool_input: { command: "npm test" } }, 3_000);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(registry.list().map((known) => known.name)).toEqual(["web-terminal"]);
    expect(registry.get("web-terminal")?.state).toBe("needs_permission");
  });

  it("turns back into a plain terminal when the Claude in it ends", () => {
    const registry = makeRegistry();
    registry.add(session("web-terminal", { agent: "shell", state: "idle", origin: "heyterm" }));
    registry.linkIntoTerminal("web-terminal", "4450a7ab", 1_000);
    registry.unlinkFromTerminal("web-terminal", 2_000);
    expect(registry.get("web-terminal")).toMatchObject({ agent: "shell", state: "idle" });
    expect(registry.get("web-terminal")?.agentSessionId).toBeUndefined();
    expect(registry.get("web-terminal")?.claudeInside).toBeUndefined();
  });
});

describe("SessionRegistry with a conversation that comes back", () => {
  // projects, then projects-2, -3 and -4 for one conversation (28 October 2026).
  it("gives a returning conversation the name it had before", async () => {
    const registry = makeRegistry();
    await registry.applyExternalHookEvent("SessionStart", { session_id: "4450a7ab", cwd: "/root/Projects" }, 1_000);
    const firstName = registry.list()[0]!.name;
    registry.remove(firstName);
    await registry.applyExternalHookEvent("UserPromptSubmit", { session_id: "4450a7ab", cwd: "/root/Projects", prompt: "go on" }, 2_000);
    expect(registry.list().map((known) => known.name)).toEqual([firstName]);
    expect(registry.recentlyClosedSessions().map((closed) => closed.name)).not.toContain(firstName);
  });
});
