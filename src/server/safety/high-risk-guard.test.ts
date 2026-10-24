import { describe, expect, it } from "vitest";
import { HighRiskGuard } from "./high-risk-guard.ts";

const projectPath = "/projects/peeker";

function guardAnswer(toolName: string, toolInput: Record<string, unknown>): unknown {
  const answer = HighRiskGuard.preToolUseAnswer({ toolName, toolInput, projectPath });
  return answer ? JSON.parse(answer) : undefined;
}

describe("HighRiskGuard.preToolUseAnswer", () => {
  it("makes Claude ask before a high-risk command, even in auto mode", () => {
    expect(guardAnswer("Bash", { command: "git push --force origin main" })).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "Callsign: this command pushes to a remote. Say confirm in Callsign to run it.",
      },
    });
  });

  it("makes Claude ask before editing a file outside the project", () => {
    expect(guardAnswer("Write", { file_path: "/Users/dev/.zshrc" })).toMatchObject({ hookSpecificOutput: { permissionDecision: "ask" } });
  });

  it("stays out of the way for everyday commands", () => {
    expect(guardAnswer("Bash", { command: "pnpm test" })).toBeUndefined();
    expect(guardAnswer("Edit", { file_path: `${projectPath}/src/menu.tsx` })).toBeUndefined();
  });

  it("stays out of the way for questions", () => {
    expect(guardAnswer("AskUserQuestion", { questions: [] })).toBeUndefined();
  });
});
