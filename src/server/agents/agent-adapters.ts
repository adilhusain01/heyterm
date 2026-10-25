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

const adapters: AgentAdapter[] = [claude, codex, gemini];

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
