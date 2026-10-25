import { describe, expect, it } from "vitest";
import { WorktreePlan } from "./worktree-plan.ts";
import type { SessionView } from "../../shared/types.ts";

function open(projectPath: string, state: SessionView["state"] = "working"): Pick<SessionView, "projectPath" | "state"> {
  return { projectPath, state };
}

describe("WorktreePlan.needsOwnWorktree", () => {
  // Two agents editing one folder can quietly undo each other's work.
  it("gives a second session in a folder with an open session its own worktree", () => {
    expect(WorktreePlan.needsOwnWorktree("/p/api", [open("/p/api")])).toBe(true);
    expect(WorktreePlan.needsOwnWorktree("/p/api", [open("/p/api", "idle")])).toBe(true);
  });

  it("counts a session in a folder inside the other, or around it", () => {
    expect(WorktreePlan.needsOwnWorktree("/p/api/web", [open("/p/api")])).toBe(true);
    expect(WorktreePlan.needsOwnWorktree("/p/api", [open("/p/api/web")])).toBe(true);
  });

  it("keeps the folder itself when no other open session uses it", () => {
    expect(WorktreePlan.needsOwnWorktree("/p/api", [])).toBe(false);
    expect(WorktreePlan.needsOwnWorktree("/p/api", [open("/p/apiary"), open("/p/web")])).toBe(false);
    expect(WorktreePlan.needsOwnWorktree("/p/api", [open("/p/api", "stopped")])).toBe(false);
  });
});

describe("WorktreePlan.branchName", () => {
  it("names the branch after the session and avoids branches that exist", () => {
    expect(WorktreePlan.branchName("api-2", [])).toBe("heyterm/api-2");
    expect(WorktreePlan.branchName("api-2", ["heyterm/api-2"])).toBe("heyterm/api-2-2");
  });
});

describe("WorktreePlan.needsOwnWorktree for terminals", () => {
  // A terminal opened in a project is for working in that folder, beside its agent.
  it("opens a terminal in the folder itself, even when an agent works there", () => {
    expect(WorktreePlan.needsOwnWorktree("/p/api", [open("/p/api")], "shell")).toBe(false);
  });

  // A shell edits nothing by itself, so it does not push an agent into a worktree.
  it("does not count an open terminal as an agent using the folder", () => {
    expect(WorktreePlan.needsOwnWorktree("/p/api", [{ ...open("/p/api", "idle"), agent: "shell" }])).toBe(false);
  });
});
