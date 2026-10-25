import { describe, expect, it } from "vitest";
import { SessionRegistry } from "./session-registry.ts";
import type { HeldHookRequests } from "../hooks/held-hook-requests.ts";
import type { StateStore } from "./state-store.ts";
import type { SessionView } from "../../shared/types.ts";

function makeRegistry(): SessionRegistry {
  const store = { save: async () => undefined } as unknown as StateStore;
  const held = { letGoAllFor: () => undefined, hold: async () => "" } as unknown as HeldHookRequests;
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
