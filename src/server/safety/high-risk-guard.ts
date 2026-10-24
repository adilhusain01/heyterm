// Auto mode runs most tool calls without asking. For a high-risk one, Callsign's PreToolUse hook
// answers "ask", so Claude Code raises a permission request that Callsign holds until "confirm".

import { PermissionRisk, type PermissionRiskInput } from "./permission-risk.ts";

export class HighRiskGuard {
  // The hook's answer for this tool call, or an empty string to let Claude Code decide as usual.
  static preToolUseAnswer(input: PermissionRiskInput): string {
    if (input.toolName === "AskUserQuestion") return "";
    const assessment = PermissionRisk.assess(input);
    if (assessment.risk !== "high") return "";
    const reason = assessment.riskReasons[0] ?? "is risky";
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: `Callsign: this command ${reason}. Say confirm in Callsign to run it.`,
      },
    });
  }
}
