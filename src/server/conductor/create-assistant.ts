// Puts the assistant together: its Claude conversation, its tools, and the check that holds its
// own risky commands for a spoken "confirm".

import { Assistant } from "./assistant.ts";
import { Conductor } from "./conductor.ts";
import { ConductorSafety } from "./conductor-rules.ts";
import { PermissionRisk } from "../safety/permission-risk.ts";
import { createConductorTools } from "./conductor-tools.ts";
import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";
import type { ActionExecutor } from "../actions/action-executor.ts";
import type { DecisionActions } from "../actions/decision-actions.ts";
import type { SessionActions } from "../actions/session-actions.ts";
import type { AuditLog } from "../safety/audit-log.ts";
import type { ProjectCatalog } from "../projects/project-catalog.ts";
import type { SessionLauncher } from "../sessions/session-launcher.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";

interface AssistantDependencies {
  model: string;
  workingDirectory: string;
  registry: SessionRegistry;
  launcher: SessionLauncher;
  projects: ProjectCatalog;
  sessionActions: SessionActions;
  decisions: DecisionActions;
  executor: ActionExecutor;
  audit: AuditLog;
}

export function createAssistant(dependencies: AssistantDependencies): Assistant {
  const { executor, audit } = dependencies;
  let assistant: Assistant | undefined;

  // The one rule Callsign adds: nothing touches a PrivateKeys folder (the developer's own standing rule).
  const beforeTool: HookCallback = async (input) => {
    if (input.hook_event_name !== "PreToolUse") return {};
    if (!ConductorSafety.touchesPrivateKeys(input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>)) return {};
    return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "The PrivateKeys folder is off limits. Do not try another way." } };
  };

  // Called only when Claude Code's own permission mode would ask the developer; then they are asked
  // out loud. Whatever Claude Code allows by itself runs without a word from Callsign.
  const askDeveloper = async (toolName: string, toolInput: Record<string, unknown>): Promise<boolean> => {
    const summary = PermissionRisk.assess({ toolName, toolInput, projectPath: dependencies.workingDirectory });
    const risk = summary.risk === "high" ? ` It ${summary.riskReasons[0]}.` : "";
    assistant?.sayNow(`I need your OK to ${spokenToolUse(toolName)}.${risk} Say approve or deny.`);
    const approved = await executor.waitForSpokenApproval(`let the assistant ${toolName === "Bash" ? `run ${summary.summary}` : summary.summary}`);
    await audit.record({ session: "assistant", decision: approved ? "approved" : "denied", subject: summary.summary, decidedBy: approved ? "spoken approval" : "no or no answer" });
    return approved;
  };

  const conductor = new Conductor({
    model: dependencies.model,
    workingDirectory: dependencies.workingDirectory,
    tools: createConductorTools(dependencies),
    beforeTool,
    askDeveloper,
  });
  assistant = new Assistant(conductor, () => executor.situation(), () => executor.currentMode());
  return assistant;
}

// What a tool call is, in words that can be said out loud.
function spokenToolUse(toolName: string): string {
  if (toolName === "Bash") return "run a command";
  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(toolName)) return "change a file";
  if (toolName === "WebFetch") return "open a web page";
  const service = /^mcp__([^_]+(?:_[^_]+)*)__(.+)$/.exec(toolName);
  if (service) return `use ${service[1]!.replaceAll("_", " ")} to ${service[2]!.replaceAll("_", " ")}`;
  return `use ${toolName}`;
}
