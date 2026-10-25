// The hook files HeyTerm writes for agents that take hooks only from global files: Grok Build
// (~/.grok/hooks/heyterm.json, a file of HeyTerm's own) and Cursor (~/.cursor/hooks.json, shared with
// the user's own hooks). Every command is tagged with its agent, because Grok also runs the hooks it
// finds in Cursor's and Claude's files. Only reporting events are registered: nothing here can approve
// or block a tool, so each agent's own permission rules stay in charge. Pure.

import { HookCommands } from "./hook-commands.ts";

type CursorHook = { command?: string; timeout?: number } & Record<string, unknown>;
type CursorHooksFile = { version?: number; hooks?: Record<string, CursorHook[]> } & Record<string, unknown>;

const grokEvents = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "StopCancelled", "StopFailure", "Notification", "SessionEnd"];
const cursorEvents = ["sessionStart", "sessionEnd", "beforeSubmitPrompt", "postToolUse", "afterAgentResponse", "stop"];
// The forwarder gives up after 3 seconds; the agent's own limit sits above it.
const hookTimeoutSeconds = 10;

export class GlobalAgentHooks {
  static grokHookFile(scriptPath: string): Record<string, unknown> {
    const hooks = Object.fromEntries(
      grokEvents.map((eventName) => [eventName, [{ hooks: [{ type: "command", command: HookCommands.forAgent(scriptPath, eventName, "grok"), timeout: hookTimeoutSeconds }] }]]),
    );
    return { hooks };
  }

  static cursorWithHeyTerm(file: CursorHooksFile, scriptPath: string): CursorHooksFile {
    const cleaned = GlobalAgentHooks.cursorWithoutHeyTerm(file);
    const hooks = { ...(cleaned.hooks ?? {}) };
    for (const eventName of cursorEvents) hooks[eventName] = [...(hooks[eventName] ?? []), { command: HookCommands.forAgent(scriptPath, eventName, "cursor"), timeout: hookTimeoutSeconds }];
    return { ...cleaned, version: cleaned.version ?? 1, hooks };
  }

  static cursorWithoutHeyTerm(file: CursorHooksFile): CursorHooksFile {
    if (!file.hooks) return file;
    const remaining: Record<string, CursorHook[]> = {};
    for (const [eventName, entries] of Object.entries(file.hooks)) {
      const kept = entries.filter((entry) => !HookCommands.isHeyTerm(entry.command ?? ""));
      if (kept.length > 0) remaining[eventName] = kept;
    }
    const { hooks: _removedHooks, ...rest } = file;
    return Object.keys(remaining).length > 0 ? { ...rest, hooks: remaining } : rest;
  }
}
