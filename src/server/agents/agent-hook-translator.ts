// Grok Build and Cursor report through hooks of their own shapes. This turns each event into the
// Claude-shaped event HeyTerm's session rules already read, so those rules stay one set. Pure.
// Sources: Grok Build 1.0.70's guide (~/.grok/docs/user-guide/10-hooks.md) and Cursor's hooks
// reference (https://cursor.com/docs/hooks.md), read on 25 October 2026.

import type { HookEventName } from "../../shared/types.ts";

export type HookedAgentKind = "grok" | "cursor";

export interface TranslatedHookEvent {
  name: HookEventName;
  // The agent's own id for the conversation, which is how HeyTerm knows which session it is.
  agentSessionId: string;
  payload: Record<string, unknown>;
}

type Payload = Record<string, unknown>;

// The tools HeyTerm's risk and activity rules name in Claude Code's words.
const grokToolNames: Record<string, string> = {
  run_terminal_command: "Bash",
  search_replace: "Edit",
  // Seen in a recorded session; the guide's alias list does not name it.
  write: "Write",
  read_file: "Read",
  list_dir: "Glob",
  grep: "Grep",
  web_search: "WebSearch",
  spawn_subagent: "Task",
  ask_user_question: "AskUserQuestion",
};
const cursorToolNames: Record<string, string> = { Shell: "Bash", Write: "Edit", Delete: "Edit" };

export class AgentHookTranslator {
  static translate(agent: HookedAgentKind, eventName: string, payload: Payload): TranslatedHookEvent | undefined {
    return agent === "grok" ? fromGrok(eventName, payload) : fromCursor(eventName, payload);
  }

  // What the hook prints when HeyTerm has nothing to say. Cursor reads a prompt hook's reply as a
  // verdict, so it gets an explicit "go ahead"; everything else stays silent and the agent decides.
  static defaultReply(agent: HookedAgentKind, eventName: string): string {
    return agent === "cursor" && eventName === "beforeSubmitPrompt" ? '{"continue":true}' : "";
  }
}

function fromGrok(eventName: string, payload: Payload): TranslatedHookEvent | undefined {
  const agentSessionId = text(payload.session_id) || text(payload.sessionId);
  if (!agentSessionId) return undefined;
  const base = { session_id: agentSessionId, cwd: text(payload.cwd) || text(payload.workspaceRoot) };
  const event = (name: HookEventName, extra: Payload = {}): TranslatedHookEvent => ({ name, agentSessionId, payload: { ...base, ...extra } });
  switch (eventName) {
    case "SessionStart":
    case "SessionEnd":
      return event(eventName);
    case "UserPromptSubmit":
      return event("UserPromptSubmit", { prompt: text(payload.prompt) || text(payload.userPrompt) });
    case "PreToolUse":
    case "PostToolUse":
      return event(eventName, grokTool(payload));
    case "Stop":
      // Grok fires one more Stop as it shuts down; the session's end, not a finished turn.
      if (text(payload.reason) === "shutdown") return undefined;
      return event("Stop", { last_assistant_message: text(payload.last_assistant_message) || text(payload.lastAssistantMessage) });
    case "StopCancelled":
      return event("Stop", { turn_cancelled: true });
    case "StopFailure":
      return event("StopFailure", { error: text(payload.error_details) || text(payload.errorDetails) || text(payload.error) });
    case "Notification": {
      const notificationType = text(payload.notification_type) || text(payload.notificationType);
      return notificationType === "permission_prompt" ? event("Notification", { waits_in_terminal: true }) : undefined;
    }
    default:
      return undefined;
  }
}

function grokTool(payload: Payload): Payload {
  const toolName = text(payload.tool_name) || text(payload.toolName);
  return { tool_name: grokToolNames[toolName] ?? toolName, tool_input: record(payload.tool_input) ?? record(payload.toolInput) ?? {} };
}

function fromCursor(eventName: string, payload: Payload): TranslatedHookEvent | undefined {
  const agentSessionId = text(payload.conversation_id) || text(payload.session_id);
  if (!agentSessionId) return undefined;
  const roots = Array.isArray(payload.workspace_roots) ? payload.workspace_roots.filter((root): root is string => typeof root === "string") : [];
  const base = { session_id: agentSessionId, cwd: roots[0] ?? text(payload.cwd) };
  const event = (name: HookEventName, extra: Payload = {}): TranslatedHookEvent => ({ name, agentSessionId, payload: { ...base, ...extra } });
  switch (eventName) {
    case "sessionStart":
      return event("SessionStart");
    case "sessionEnd":
      return event("SessionEnd");
    case "beforeSubmitPrompt":
      return event("UserPromptSubmit", { prompt: text(payload.prompt) });
    case "postToolUse": {
      const toolName = text(payload.tool_name);
      return event("PostToolUse", { tool_name: cursorToolNames[toolName] ?? toolName, tool_input: record(payload.tool_input) ?? {} });
    }
    case "afterAgentResponse":
      return event("Notification", { assistant_message: text(payload.text) });
    case "stop": {
      const status = text(payload.status);
      if (status === "error") return event("StopFailure", { error: "the turn ended on an error" });
      if (status === "aborted") return event("Stop", { turn_cancelled: true });
      // Cursor sends the reply in afterAgentResponse, before the turn ends.
      return event("Stop", { keep_last_message: true });
    }
    default:
      return undefined;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function record(value: unknown): Payload | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Payload) : undefined;
}
