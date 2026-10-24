// Puts the assistant together: its Claude conversation, its tools, and the check that holds its
// own risky commands for a spoken "confirm".

import { Assistant } from "./assistant.ts";
import { Conductor } from "./conductor.ts";
import { ConductorSafety } from "./conductor-rules.ts";
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

  const beforeCommand: HookCallback = async (input) => {
    const command = input.hook_event_name === "PreToolUse" ? String((input.tool_input as { command?: unknown } | undefined)?.command ?? "") : "";
    const decision = ConductorSafety.commandDecision(command);
    if (!decision.needsConfirm) return {};
    assistant?.sayNow(`I want to run a command that ${decision.reason}. Say confirm to let me, or cancel.`);
    const confirmed = await executor.waitForSpokenConfirm(`let the assistant run ${command}`);
    await audit.record({ session: "assistant", decision: confirmed ? "approved" : "denied", subject: command, decidedBy: confirmed ? "spoken confirm" : "no confirm within a minute" });
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: confirmed ? "allow" : "deny",
        permissionDecisionReason: confirmed ? "The developer said confirm." : "The developer did not confirm this command. Do not run it another way.",
      },
    };
  };

  const conductor = new Conductor({
    model: dependencies.model,
    workingDirectory: dependencies.workingDirectory,
    tools: createConductorTools(dependencies),
    beforeCommand,
  });
  assistant = new Assistant(conductor, () => executor.situation(), () => executor.currentMode());
  return assistant;
}
