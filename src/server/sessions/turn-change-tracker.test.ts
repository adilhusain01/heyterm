import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TurnChangeTracker } from "./turn-change-tracker.ts";
import type { SessionView } from "../../shared/types.ts";

function repository(): string {
  const folder = mkdtempSync(path.join(os.tmpdir(), "heyterm-turn-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", folder, ...args]);
  git("init", "-q");
  writeFileSync(path.join(folder, "notes.txt"), "hi\n");
  writeFileSync(path.join(folder, "draft.md"), "draft\n");
  git("add", "notes.txt");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "start");
  return folder;
}

function sessionIn(projectPath: string): SessionView {
  return { name: "hello", projectPath, projectName: "hello", agent: "claude", state: "idle", stateSince: 0, createdAt: 1, lastSeenAt: 0, activitySinceSeen: [], waitedMillisecondsToday: 0 };
}

describe("TurnChangeTracker, in a real repository", () => {
  it("finds shell edits, new files and commits made during the task, and not files left as they were", async () => {
    const folder = repository();
    const tracker = new TurnChangeTracker();
    await tracker.taskStarted(sessionIn(folder));
    appendFileSync(path.join(folder, "notes.txt"), "bye\n");
    writeFileSync(path.join(folder, "todo.md"), "ship it\n");
    expect((await tracker.filesChangedByTask(sessionIn(folder))).sort()).toEqual(["notes.txt", "todo.md"]);
  });

  it("names files relative to a project that is a folder inside the repository", async () => {
    const folder = repository();
    mkdirSync(path.join(folder, "web"));
    const project = path.join(folder, "web");
    const tracker = new TurnChangeTracker();
    await tracker.taskStarted(sessionIn(project));
    writeFileSync(path.join(project, "page.tsx"), "x\n");
    writeFileSync(path.join(folder, "outside.txt"), "y\n");
    expect(await tracker.filesChangedByTask(sessionIn(project))).toEqual(["page.tsx"]);
  });

  it("knows nothing outside a repository", async () => {
    const folder = mkdtempSync(path.join(os.tmpdir(), "heyterm-plain-"));
    const tracker = new TurnChangeTracker();
    tracker.taskStarted(sessionIn(folder));
    writeFileSync(path.join(folder, "a.txt"), "a\n");
    expect(await tracker.filesChangedByTask(sessionIn(folder))).toEqual([]);
  });
});
