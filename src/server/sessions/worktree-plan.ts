// When a new session gets its own git worktree, and what its branch is called. Two agents editing
// one folder can quietly undo each other's work, so a second session in a folder another open
// session uses works in a worktree of its own. Pure.

import path from "node:path";
import type { SessionView } from "../../shared/types.ts";

export class WorktreePlan {
  static needsOwnWorktree(projectPath: string, openSessions: Array<Pick<SessionView, "projectPath" | "state">>): boolean {
    return openSessions.some((session) => session.state !== "stopped" && foldersOverlap(session.projectPath, projectPath));
  }

  static branchName(sessionName: string, existingBranches: string[]): string {
    const base = `heyterm/${sessionName}`;
    if (!existingBranches.includes(base)) return base;
    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${base}-${suffix}`;
      if (!existingBranches.includes(candidate)) return candidate;
    }
  }
}

function foldersOverlap(first: string, second: string): boolean {
  const a = path.resolve(first);
  const b = path.resolve(second);
  return a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
}
