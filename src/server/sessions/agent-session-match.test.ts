import { describe, expect, it } from "vitest";
import { AgentSessionMatch } from "./agent-session-match.ts";
import type { SessionView } from "../../shared/types.ts";

function session(name: string, overrides: Partial<SessionView>): SessionView {
  return { name, projectPath: `/p/${name}`, projectName: name, agent: "grok", state: "starting", stateSince: 0, createdAt: 0, lastSeenAt: 0, activitySinceSeen: [], waitedMillisecondsToday: 0, ...overrides };
}

describe("AgentSessionMatch.find", () => {
  it("finds the session by the id the agent reports", () => {
    const api = session("api", { agentSessionId: "grok-1" });
    expect(AgentSessionMatch.find([api], "grok", "grok-1", "/p/api")).toEqual({ session: api, claimsId: false });
  });

  it("claims a new Cursor conversation for the session HeyTerm just started in that folder", () => {
    const older = session("web", { agent: "cursor", projectPath: "/p/web", createdAt: 1 });
    const newer = session("web-2", { agent: "cursor", projectPath: "/p/web", createdAt: 5 });
    expect(AgentSessionMatch.find([older, newer], "cursor", "chat-9", "/p/web")).toEqual({ session: newer, claimsId: true });
  });

  it("never claims for a session that already has its own conversation", () => {
    const taken = session("web", { agent: "cursor", projectPath: "/p/web", agentSessionId: "chat-1" });
    expect(AgentSessionMatch.find([taken], "cursor", "chat-9", "/p/web")).toBeUndefined();
  });

  it("ignores the user's own sessions, in folders or agents HeyTerm is not running", () => {
    const api = session("api", { agent: "grok", projectPath: "/p/api" });
    expect(AgentSessionMatch.find([api], "cursor", "chat-9", "/p/api")).toBeUndefined();
    expect(AgentSessionMatch.find([api], "grok", "grok-9", "/p/elsewhere")).toBeUndefined();
  });

  it("never matches a session the user started in their own terminal", () => {
    const outside = session("api", { origin: "external", agentSessionId: "grok-1" });
    expect(AgentSessionMatch.find([outside], "grok", "grok-1", "/p/api")).toBeUndefined();
  });
});
