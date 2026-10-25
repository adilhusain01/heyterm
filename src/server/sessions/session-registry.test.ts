import { describe, expect, it } from "vitest";
import { SessionRegistry } from "./session-registry.ts";
import type { HeldHookRequests } from "../hooks/held-hook-requests.ts";
import type { StateStore } from "./state-store.ts";
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
