import { describe, expect, it } from "vitest";
import { AgentAdapters } from "./agent-adapters.ts";

const context = { sessionName: "web", claudeSettingsPath: "/data/claude-settings.json", hookCommand: (event: string) => `node /data/forward.cjs ${event}` };

describe("AgentAdapters", () => {
  it("starts Claude Code with HeyTerm's settings for this session only, under the session's name", () => {
    expect(AgentAdapters.get("claude").newSession(context)).toEqual({ program: "claude", args: ["--settings", "/data/claude-settings.json", "-n", "web"] });
  });

  it("resumes Claude Code by its session id when Claude saved the conversation", () => {
    const launch = AgentAdapters.get("claude").resume({ agentSessionId: "abc", conversationSaved: true }, context);
    expect(launch.args.slice(0, 2)).toEqual(["--resume", "abc"]);
  });

  it("starts Claude Code fresh when there is nothing to resume", () => {
    expect(AgentAdapters.get("claude").resume({ agentSessionId: "abc", conversationSaved: false }, context).args).not.toContain("--resume");
  });

  it("gives Codex its hooks as config overrides for this run only, never touching ~/.codex", () => {
    const launch = AgentAdapters.get("codex").newSession(context);
    expect(launch.program).toBe("codex");
    const overrides = launch.args.filter((_, index) => launch.args[index - 1] === "-c");
    expect(overrides).toContain('hooks.PermissionRequest=[{hooks=[{type="command",command="node /data/forward.cjs PermissionRequest",timeout=595}]}]');
    expect(overrides).toContain('hooks.Stop=[{hooks=[{type="command",command="node /data/forward.cjs Stop",timeout=10}]}]');
    expect(launch.args).not.toContain("--dangerously-bypass-hook-trust");
  });

  it("resumes Codex by its session id", () => {
    const launch = AgentAdapters.get("codex").resume({ agentSessionId: "019a-uuid", conversationSaved: true }, context);
    expect(launch.args.slice(0, 2)).toEqual(["resume", "019a-uuid"]);
  });

  it("names every agent it knows, for the start menu and the assistant", () => {
    expect(AgentAdapters.all().map((adapter) => adapter.kind)).toEqual(["claude", "codex", "gemini", "grok", "cursor"]);
  });

  it("starts Grok Build under the session id HeyTerm chose, so its hook events can be told apart", () => {
    expect(AgentAdapters.get("grok").newSession({ ...context, agentSessionId: "0199-grok" })).toEqual({ program: "grok", args: ["-s", "0199-grok"] });
  });

  it("resumes Grok Build by that id once it has a conversation", () => {
    expect(AgentAdapters.get("grok").resume({ agentSessionId: "0199-grok", conversationSaved: true }, context)).toEqual({ program: "grok", args: ["-r", "0199-grok"] });
    expect(AgentAdapters.get("grok").resume({ agentSessionId: "0199-grok", conversationSaved: false }, { ...context, agentSessionId: "0199-new" }).args).toEqual(["-s", "0199-new"]);
  });

  it("runs Cursor as cursor-agent, since Grok's own agent command can come first on the PATH", () => {
    expect(AgentAdapters.get("cursor").newSession(context)).toEqual({ program: "cursor-agent", args: [] });
    expect(AgentAdapters.get("cursor").resume({ agentSessionId: "chat-1", conversationSaved: true }, context)).toEqual({ program: "cursor-agent", args: ["--resume", "chat-1"] });
  });

  it("knows which agents need an id chosen before they start", () => {
    expect(AgentAdapters.all().filter((adapter) => adapter.choosesSessionIdAtLaunch).map((adapter) => adapter.kind)).toEqual(["grok"]);
  });

  // Asked on 26 October 2026: "open a terminal" opened the Terminal app, as HeyTerm had no plain shell.
  it("starts a terminal as the developer's own login shell, with no agent and no hooks", () => {
    const launch = AgentAdapters.get("shell").newSession(context);
    if (process.platform === "win32") expect(launch.args).toEqual([]);
    else expect(launch).toEqual({ program: process.env.SHELL || "/bin/zsh", args: ["-l"] });
  });

  it("brings a closed terminal back as a fresh shell, since a shell keeps no conversation", () => {
    expect(AgentAdapters.get("shell").resume({ agentSessionId: "abc", conversationSaved: true }, context)).toEqual(AgentAdapters.get("shell").newSession(context));
  });

  it("knows the terminal as a kind of session but lists only coding agents in setup", () => {
    expect(AgentAdapters.isKnown("shell")).toBe(true);
    expect(AgentAdapters.all().map((adapter) => adapter.kind)).not.toContain("shell");
  });
});
