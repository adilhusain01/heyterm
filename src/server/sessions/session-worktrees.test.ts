import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SessionWorktrees } from "./session-worktrees.ts";

function repository(): string {
  const folder = mkdtempSync(path.join(os.tmpdir(), "heyterm-repo-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", folder, ...args]);
  git("init", "-q");
  // Git on Windows may turn line endings into CRLF on checkout; these tests compare file contents.
  git("config", "core.autocrlf", "false");
  writeFileSync(path.join(folder, "notes.txt"), "hi\n");
  git("add", ".");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "start");
  return folder;
}

describe("SessionWorktrees", () => {
  it("makes a worktree on its own branch from the last commit, apart from the folder's files", async () => {
    const repo = repository();
    writeFileSync(path.join(repo, "notes.txt"), "uncommitted\n");
    const worktrees = new SessionWorktrees(mkdtempSync(path.join(os.tmpdir(), "heyterm-data-")));
    const worktree = await worktrees.create(repo, "api-2");
    expect(worktree?.branch).toBe("heyterm/api-2");
    expect(readFileSync(path.join(worktree!.path, "notes.txt"), "utf8")).toBe("hi\n");
    writeFileSync(path.join(worktree!.path, "notes.txt"), "from the second session\n");
    expect(readFileSync(path.join(repo, "notes.txt"), "utf8")).toBe("uncommitted\n");
  });

  it("makes none outside a repository or in one with no commits", async () => {
    const worktrees = new SessionWorktrees(mkdtempSync(path.join(os.tmpdir(), "heyterm-data-")));
    expect(await worktrees.create(mkdtempSync(path.join(os.tmpdir(), "heyterm-plain-")), "x")).toBeUndefined();
    const empty = mkdtempSync(path.join(os.tmpdir(), "heyterm-empty-"));
    execFileSync("git", ["-C", empty, "init", "-q"]);
    expect(await worktrees.create(empty, "x")).toBeUndefined();
  });

  it("removes a worktree and its branch only when nothing in it would be lost", async () => {
    const repo = repository();
    const worktrees = new SessionWorktrees(mkdtempSync(path.join(os.tmpdir(), "heyterm-data-")));
    const unused = (await worktrees.create(repo, "api-2"))!;
    expect(await worktrees.removeIfUnused(unused)).toBe("removed");
    expect(existsSync(unused.path)).toBe(false);

    const edited = (await worktrees.create(repo, "api-3"))!;
    writeFileSync(path.join(edited.path, "notes.txt"), "changed\n");
    expect(await worktrees.removeIfUnused(edited)).toBe("kept_uncommitted");

    const committed = (await worktrees.create(repo, "api-4"))!;
    writeFileSync(path.join(committed.path, "more.txt"), "x\n");
    execFileSync("git", ["-C", committed.path, "add", "."]);
    execFileSync("git", ["-C", committed.path, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "work"]);
    expect(await worktrees.removeIfUnused(committed)).toBe("kept_commits");
    expect(existsSync(committed.path)).toBe(true);
  });
});
