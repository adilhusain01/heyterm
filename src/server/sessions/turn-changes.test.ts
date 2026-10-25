import { describe, expect, it } from "vitest";
import { TurnChanges, type FolderSnapshot } from "./turn-changes.ts";

function snapshot(head: string, files: Record<string, string>): FolderSnapshot {
  return { head, changedFiles: new Map(Object.entries(files)) };
}

describe("TurnChanges.between", () => {
  // Seen on 25 October 2026: Claude Code appended to notes.txt and created todo.md with a shell
  // command, so no Edit or Write hook named them.
  it("finds files a task changed with a shell command, new ones included", () => {
    const before = snapshot("aaa", {});
    const after = snapshot("aaa", { "notes.txt": "h1", "todo.md": "h2" });
    expect(TurnChanges.between(before, after, [])).toEqual(["notes.txt", "todo.md"]);
  });

  it("leaves out files that were already changed before the task and stayed as they were", () => {
    const before = snapshot("aaa", { "draft.md": "same", "notes.txt": "old" });
    const after = snapshot("aaa", { "draft.md": "same", "notes.txt": "new" });
    expect(TurnChanges.between(before, after, [])).toEqual(["notes.txt"]);
  });

  it("counts a file the task reverted or deleted", () => {
    const before = snapshot("aaa", { "notes.txt": "edited" });
    const after = snapshot("aaa", { "gone.txt": "deleted" });
    expect(TurnChanges.between(before, after, [])).toEqual(["notes.txt", "gone.txt"]);
  });

  it("adds what the task committed", () => {
    const before = snapshot("aaa", { "a.ts": "x" });
    const after = snapshot("bbb", {});
    expect(TurnChanges.between(before, after, ["a.ts", "b.ts"])).toEqual(["a.ts", "b.ts"]);
  });
});
