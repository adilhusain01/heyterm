import { describe, expect, it } from "vitest";
import { AgentHookTranslator } from "./agent-hook-translator.ts";

// Payloads shaped like the ones in Grok Build 1.0.70's guide (~/.grok/docs/user-guide/10-hooks.md)
// and Cursor's hooks reference (https://cursor.com/docs/hooks.md), read on 25 October 2026.
const grokCommon = { hookEventName: "pre_tool_use", sessionId: "grok-1", session_id: "grok-1", cwd: "/p/api", workspaceRoot: "/p/api" };
const cursorCommon = { conversation_id: "chat-1", generation_id: "gen-1", cursor_version: "2026.10.22", workspace_roots: ["/p/web"] };

describe("AgentHookTranslator, for Grok Build", () => {
  it("reads a submitted prompt with Grok's session id", () => {
    expect(AgentHookTranslator.translate("grok", "UserPromptSubmit", { ...grokCommon, prompt: "fix the header" })).toEqual({
      name: "UserPromptSubmit",
      agentSessionId: "grok-1",
      payload: { session_id: "grok-1", cwd: "/p/api", prompt: "fix the header" },
    });
  });

  it("names Grok's tools the way HeyTerm's risk and activity rules know them", () => {
    const shell = AgentHookTranslator.translate("grok", "PreToolUse", { ...grokCommon, toolName: "run_terminal_command", toolInput: { command: "npm test" } });
    expect(shell?.payload).toMatchObject({ tool_name: "Bash", tool_input: { command: "npm test" } });
    const edit = AgentHookTranslator.translate("grok", "PostToolUse", { ...grokCommon, toolName: "search_replace", toolInput: { file_path: "/p/api/a.ts" } });
    expect(edit?.payload).toMatchObject({ tool_name: "Edit", tool_input: { file_path: "/p/api/a.ts" } });
  });

  it("ends a turn with the agent's last words", () => {
    expect(AgentHookTranslator.translate("grok", "Stop", { ...grokCommon, last_assistant_message: "Tests pass." })?.payload).toMatchObject({ last_assistant_message: "Tests pass." });
  });

  it("treats an interrupted turn as cancelled, not finished", () => {
    expect(AgentHookTranslator.translate("grok", "StopCancelled", { ...grokCommon, reason: "user_interrupt" })).toMatchObject({ name: "Stop", payload: { turn_cancelled: true } });
  });

  it("carries the error of a failed turn", () => {
    expect(AgentHookTranslator.translate("grok", "StopFailure", { ...grokCommon, error_details: "rate limit" })).toMatchObject({ name: "StopFailure", payload: { error: "rate limit" } });
  });

  it("marks a waiting permission card as something to answer in Grok's terminal, since no hook can approve it", () => {
    expect(AgentHookTranslator.translate("grok", "Notification", { ...grokCommon, notification_type: "permission_prompt" })).toMatchObject({
      name: "Notification",
      payload: { waits_in_terminal: true },
    });
  });

  it("ignores notifications that other events already cover", () => {
    expect(AgentHookTranslator.translate("grok", "Notification", { ...grokCommon, notification_type: "idle_prompt" })).toBeUndefined();
  });
});

describe("AgentHookTranslator, on events recorded from Grok Build 1.0.70 on 25 October 2026", () => {
  const recorded = { hook_event_name: "PreToolUse", session_id: "01a17272-bc61", cwd: "/p/api", permission_mode: "bypassPermissions" };

  it("names Grok's file-writing tool as Claude Code's Write", () => {
    expect(AgentHookTranslator.translate("grok", "PreToolUse", { ...recorded, toolName: "write", tool_name: "write" })?.payload).toMatchObject({ tool_name: "Write" });
  });

  it("ignores the extra Stop Grok fires as it shuts down, which is not a finished turn", () => {
    expect(AgentHookTranslator.translate("grok", "Stop", { ...recorded, hook_event_name: "Stop", reason: "shutdown" })).toBeUndefined();
  });

  it("keeps a real turn end, which Grok marks end_turn", () => {
    expect(AgentHookTranslator.translate("grok", "Stop", { ...recorded, hook_event_name: "Stop", reason: "end_turn", last_assistant_message: "Created hello.txt." })?.name).toBe("Stop");
  });
});

describe("AgentHookTranslator, for Cursor", () => {
  it("reads a submitted prompt under the conversation id", () => {
    expect(AgentHookTranslator.translate("cursor", "beforeSubmitPrompt", { ...cursorCommon, prompt: "add a test" })).toEqual({
      name: "UserPromptSubmit",
      agentSessionId: "chat-1",
      payload: { session_id: "chat-1", cwd: "/p/web", prompt: "add a test" },
    });
  });

  it("reads a session's start and end", () => {
    expect(AgentHookTranslator.translate("cursor", "sessionStart", { ...cursorCommon, session_id: "chat-1" })?.name).toBe("SessionStart");
    expect(AgentHookTranslator.translate("cursor", "sessionEnd", { ...cursorCommon, session_id: "chat-1", reason: "user_close" })?.name).toBe("SessionEnd");
  });

  it("names Cursor's shell tool as HeyTerm knows it", () => {
    const shell = AgentHookTranslator.translate("cursor", "postToolUse", { ...cursorCommon, tool_name: "Shell", tool_input: { command: "pnpm lint" } });
    expect(shell).toMatchObject({ name: "PostToolUse", payload: { tool_name: "Bash", tool_input: { command: "pnpm lint" } } });
  });

  it("keeps the agent's reply, which Cursor sends before the turn ends", () => {
    expect(AgentHookTranslator.translate("cursor", "afterAgentResponse", { ...cursorCommon, text: "Added the test." })).toMatchObject({
      name: "Notification",
      payload: { assistant_message: "Added the test." },
    });
  });

  it("ends a turn by its status", () => {
    expect(AgentHookTranslator.translate("cursor", "stop", { ...cursorCommon, status: "completed" })).toMatchObject({ name: "Stop", payload: { keep_last_message: true } });
    expect(AgentHookTranslator.translate("cursor", "stop", { ...cursorCommon, status: "aborted" })).toMatchObject({ name: "Stop", payload: { turn_cancelled: true } });
    expect(AgentHookTranslator.translate("cursor", "stop", { ...cursorCommon, status: "error" })?.name).toBe("StopFailure");
  });

  it("ignores events it has no use for", () => {
    expect(AgentHookTranslator.translate("cursor", "afterAgentThought", { ...cursorCommon, text: "hmm" })).toBeUndefined();
  });
});

describe("AgentHookTranslator.defaultReply", () => {
  it("lets a Cursor prompt through, since an empty reply could hold it back", () => {
    expect(AgentHookTranslator.defaultReply("cursor", "beforeSubmitPrompt")).toBe('{"continue":true}');
  });

  it("says nothing for every other event, so the agent decides as it would alone", () => {
    expect(AgentHookTranslator.defaultReply("grok", "PreToolUse")).toBe("");
    expect(AgentHookTranslator.defaultReply("cursor", "stop")).toBe("");
  });
});
