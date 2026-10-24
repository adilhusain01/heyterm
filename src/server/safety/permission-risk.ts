// Decides whether a spoken "yes" is enough to approve a tool call, or "confirm" is needed.

import path from "node:path";
import type { RiskLevel } from "../../shared/types.ts";

export interface PermissionRiskInput {
  toolName: string;
  toolInput: Record<string, unknown>;
  projectPath: string;
}

export interface PermissionRiskAssessment {
  risk: RiskLevel;
  riskReasons: string[];
  summary: string;
}

interface CommandRule {
  pattern: RegExp;
  reason: string;
}

const highRiskCommandRules: CommandRule[] = [
  { pattern: /\brm\s+(-[a-z]*[rf][a-z]*\s+)+/i, reason: "deletes files recursively or by force" },
  { pattern: /\bgit\s+push\b/i, reason: "pushes to a remote" },
  { pattern: /\bgit\s+reset\s+--hard\b/i, reason: "throws away commits or changes" },
  { pattern: /\bgit\s+clean\s+-[a-z]*f/i, reason: "deletes untracked files" },
  { pattern: /\bgit\s+branch\s+-D\b/, reason: "deletes a branch" },
  { pattern: /(^|[;&|]\s*)sudo\b/, reason: "runs as root" },
  { pattern: /\b(curl|wget)\b[^|]*\|\s*(sh|bash|zsh)\b/i, reason: "runs a downloaded script" },
  { pattern: /\b(npm|pnpm|yarn|bun)\s+publish\b/i, reason: "publishes a package" },
  { pattern: /\bvercel\b.*--prod\b/i, reason: "deploys to production" },
  { pattern: /\b(fly|flyctl)\s+deploy\b/i, reason: "deploys" },
  { pattern: /\b(drop\s+(table|database|schema)|truncate\s+table)\b/i, reason: "deletes database data" },
  { pattern: /\bterraform\s+(apply|destroy)\b/i, reason: "changes cloud infrastructure" },
  { pattern: /\bkubectl\s+delete\b/i, reason: "deletes cluster resources" },
  { pattern: /\bchmod\s+-R\s+777\b/, reason: "opens file permissions to everyone" },
  { pattern: /\b(mkfs|dd\s+if=)/, reason: "writes to a disk directly" },
];

const secretFileNames = /(^|\/)(\.env(\..*)?|.*\.pem|id_(rsa|ed25519)|credentials(\.json)?)$/i;

// Words in a connected-service tool name that mean it changes something outside.
const outwardToolVerbs = /(^|_)(send|post|delete|remove|create|update|deploy|publish|merge|write|push|archive|invite)(_|$)/i;

export class PermissionRisk {
  static assess(input: PermissionRiskInput): PermissionRiskAssessment {
    const { toolName, toolInput, projectPath } = input;
    if (toolName === "Bash") return PermissionRisk.assessCommand(stringField(toolInput, "command"));
    if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(toolName)) {
      return PermissionRisk.assessFileEdit(stringField(toolInput, "file_path") || stringField(toolInput, "notebook_path"), projectPath);
    }
    if (toolName === "WebFetch") return { risk: "low", riskReasons: [], summary: `fetch ${stringField(toolInput, "url")}` };
    if (toolName.startsWith("mcp__")) return PermissionRisk.assessConnectedServiceTool(toolName);
    return { risk: "low", riskReasons: [], summary: `use ${toolName}` };
  }

  private static assessCommand(command: string): PermissionRiskAssessment {
    const riskReasons = highRiskCommandRules.filter((rule) => rule.pattern.test(command)).map((rule) => rule.reason);
    return { risk: riskReasons.length > 0 ? "high" : "low", riskReasons, summary: command };
  }

  private static assessFileEdit(filePath: string, projectPath: string): PermissionRiskAssessment {
    const relativePath = path.relative(projectPath, filePath);
    const isOutsideProject = relativePath.startsWith("..") || path.isAbsolute(relativePath);
    const riskReasons: string[] = [];
    if (isOutsideProject) riskReasons.push("edits a file outside the project");
    if (secretFileNames.test(filePath)) riskReasons.push("edits a file that holds secrets");
    const shownPath = isOutsideProject ? filePath : relativePath;
    return { risk: riskReasons.length > 0 ? "high" : "low", riskReasons, summary: `edit ${shownPath}` };
  }

  private static assessConnectedServiceTool(toolName: string): PermissionRiskAssessment {
    const [, serviceName = "service", ...actionParts] = toolName.split("__");
    const actionName = actionParts.join("__");
    const changesSomething = outwardToolVerbs.test(actionName);
    return {
      risk: changesSomething ? "high" : "low",
      riskReasons: changesSomething ? [`changes something in ${serviceName}`] : [],
      summary: `${serviceName}: ${actionName.replaceAll("_", " ")}`,
    };
  }
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}
