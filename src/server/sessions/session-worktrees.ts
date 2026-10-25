// Makes and removes the git worktrees HeyTerm gives sessions that share a folder (see
// worktree-plan.ts). They live in HeyTerm's data folder, out of the repository and the project list.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { WorktreePlan } from "./worktree-plan.ts";
import type { SessionWorktree } from "../../shared/types.ts";

export type WorktreeRemoval = "removed" | "kept_uncommitted" | "kept_commits" | "missing";

export class SessionWorktrees {
  constructor(private readonly dataDirectory: string) {}

  // A worktree for the session, with the folder it should work in, or undefined where git cannot make one.
  async create(projectPath: string, sessionName: string): Promise<(SessionWorktree & { path: string }) | undefined> {
    const repoPath = (await git(projectPath, ["rev-parse", "--show-toplevel"]))?.trim();
    const baseCommit = (await git(projectPath, ["rev-parse", "HEAD"]))?.trim();
    // The project's folder within the repository, from git itself, so links such as /var on macOS do not matter.
    const prefix = (await git(projectPath, ["rev-parse", "--show-prefix"]))?.trim() ?? "";
    if (!repoPath || !baseCommit) return undefined;
    const existingBranches = ((await git(repoPath, ["for-each-ref", "--format=%(refname:short)", "refs/heads/heyterm"])) ?? "").split("\n").filter(Boolean);
    const branch = WorktreePlan.branchName(sessionName, existingBranches);
    const worktreePath = freeFolder(path.join(this.dataDirectory, "worktrees", `${path.basename(repoPath)}-${sessionName}`));
    if ((await git(repoPath, ["worktree", "add", "-q", "-b", branch, worktreePath, baseCommit])) === undefined) return undefined;
    // A project inside the repository works in the same folder inside the worktree.
    const sessionPath = prefix ? path.join(worktreePath, prefix) : worktreePath;
    return { repoPath, worktreePath, branch, baseCommit, path: sessionPath };
  }

  // Never deletes work: a worktree with uncommitted changes or commits of its own stays.
  async removeIfUnused(worktree: SessionWorktree): Promise<WorktreeRemoval> {
    if (!existsSync(worktree.worktreePath)) {
      await git(worktree.repoPath, ["worktree", "prune"]);
      return "missing";
    }
    if (((await git(worktree.worktreePath, ["status", "--porcelain"])) ?? "x").trim()) return "kept_uncommitted";
    const ownCommits = Number(((await git(worktree.worktreePath, ["rev-list", "--count", `${worktree.baseCommit}..HEAD`])) ?? "1").trim());
    if (ownCommits > 0) return "kept_commits";
    await git(worktree.repoPath, ["worktree", "remove", worktree.worktreePath]);
    await git(worktree.repoPath, ["branch", "-D", worktree.branch]);
    return "removed";
  }
}

function freeFolder(wanted: string): string {
  if (!existsSync(wanted)) return wanted;
  for (let suffix = 2; ; suffix += 1) if (!existsSync(`${wanted}-${suffix}`)) return `${wanted}-${suffix}`;
}

function git(folder: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => execFile("git", ["-C", folder, ...args], { timeout: 15_000 }, (error, stdout) => resolve(error ? undefined : stdout)));
}
