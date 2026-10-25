// The coding agents HeyTerm can run, and how each one is started, resumed and wired to HeyTerm's
// hooks for that one session, without changing the user's own configuration.

import type { AgentKind } from "../../shared/types.ts";

export interface AgentLaunch {
  program: string;
  args: string[];
}

export interface AgentLaunchContext {
  sessionName: string;
  claudeSettingsPath: string;
  // The command that forwards one hook event to HeyTerm.
  hookCommand: (eventName: string) => string;
  // For agents that take a session id at launch (Grok Build): the id HeyTerm chose for a new conversation.
  agentSessionId?: string;
}

export interface ResumePoint {
  agentSessionId?: string;
  conversationSaved: boolean;
}

export interface AgentAdapter {
  kind: AgentKind;
  label: string;
  program: string;
  // What to run when the agent is missing.
  installHint: string;
  newSession(context: AgentLaunchContext): AgentLaunch;
  resume(point: ResumePoint, context: AgentLaunchContext): AgentLaunch;
  // HeyTerm picks the id before launch, because the agent's hooks come from a global file and the
  // id is how HeyTerm knows its own sessions' events.
  choosesSessionIdAtLaunch?: boolean;
}

// The agent waits this long for an answer to a permission; HeyTerm answers or lets go first.
const permissionHookSeconds = 595;
const codexHookEvents = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PermissionRequest", "Stop", "SessionEnd"];

const claude: AgentAdapter = {
  kind: "claude",
  label: "Claude Code",
  program: "claude",
  installHint: "Install it from code.claude.com, then sign in once by running claude.",
  newSession: (context) => ({ program: "claude", args: ["--settings", context.claudeSettingsPath, "-n", context.sessionName] }),
  resume: (point, context) => {
    const resumeArguments = point.agentSessionId && point.conversationSaved ? ["--resume", point.agentSessionId] : [];
    return { program: "claude", args: [...resumeArguments, "--settings", context.claudeSettingsPath, "-n", context.sessionName] };
  },
};

// Codex reads hooks from config; -c overrides apply to this run only. Codex asks the user to trust
// a new hook once (by its hash), so HeyTerm's hooks are trusted once and stay trusted.
const codex: AgentAdapter = {
  kind: "codex",
  label: "Codex",
  program: "codex",
  installHint: "Install it with npm install -g @openai/codex, then sign in with codex login.",
  newSession: (context) => ({ program: "codex", args: codexHookOverrides(context) }),
  resume: (point, context) => ({
    program: "codex",
    args: point.agentSessionId && point.conversationSaved ? ["resume", point.agentSessionId, ...codexHookOverrides(context)] : codexHookOverrides(context),
  }),
};

const gemini: AgentAdapter = {
  kind: "gemini",
  label: "Gemini CLI",
  program: "gemini",
  installHint: "Install it with npm install -g @google/gemini-cli, then sign in by running gemini.",
  newSession: () => ({ program: "gemini", args: [] }),
  resume: (point) => ({ program: "gemini", args: point.agentSessionId && point.conversationSaved ? ["--resume", point.agentSessionId] : [] }),
};

// Grok Build reads hooks only from global files, so HeyTerm writes ~/.grok/hooks/heyterm.json while it
// runs and starts each session under an id it chose (see agent-hook-translator.ts).
const grok: AgentAdapter = {
  kind: "grok",
  label: "Grok Build",
  program: "grok",
  installHint: "Install it with curl -fsSL https://x.ai/cli/install.sh | bash, then sign in with grok login.",
  choosesSessionIdAtLaunch: true,
  newSession: (context) => ({ program: "grok", args: context.agentSessionId ? ["-s", context.agentSessionId] : [] }),
  resume: (point, context) => {
    if (point.agentSessionId && point.conversationSaved) return { program: "grok", args: ["-r", point.agentSessionId] };
    return grok.newSession(context);
  },
};

// Cursor reads hooks only from ~/.cursor/hooks.json, so HeyTerm adds its own entries there while it
// runs. Its command is cursor-agent: Grok Build also puts an "agent" command on the PATH.
const cursor: AgentAdapter = {
  kind: "cursor",
  label: "Cursor",
  program: "cursor-agent",
  installHint: "Install it with curl https://cursor.com/install -fsS | bash, then sign in with cursor-agent login.",
  newSession: () => ({ program: "cursor-agent", args: [] }),
  resume: (point) => ({ program: "cursor-agent", args: point.agentSessionId && point.conversationSaved ? ["--resume", point.agentSessionId] : [] }),
};

const adapters: AgentAdapter[] = [claude, codex, gemini, grok, cursor];

export class AgentAdapters {
  static get(kind: AgentKind): AgentAdapter {
    return adapters.find((adapter) => adapter.kind === kind) ?? claude;
  }

  static all(): AgentAdapter[] {
    return adapters;
  }

  static isKnown(kind: string): kind is AgentKind {
    return adapters.some((adapter) => adapter.kind === kind);
  }
}

function codexHookOverrides(context: AgentLaunchContext): string[] {
  return codexHookEvents.flatMap((eventName) => {
    const timeout = eventName === "PermissionRequest" ? permissionHookSeconds : 10;
    return ["-c", `hooks.${eventName}=[{hooks=[{type="command",command=${tomlString(context.hookCommand(eventName))},timeout=${timeout}}]}]`];
  });
}

// A TOML basic string; JSON's escaping is valid TOML for these characters.
function tomlString(value: string): string {
  return JSON.stringify(value);
}
