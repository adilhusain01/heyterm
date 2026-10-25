import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ClaudeConversationFile } from "./claude-conversation-file.ts";

const folders: string[] = [];
function projectsDirectory(): string {
  const folder = mkdtempSync(path.join(tmpdir(), "heyterm-projects-"));
  folders.push(folder);
  return folder;
}
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe("ClaudeConversationFile.find", () => {
  it("uses the path the hooks reported when the file is there", async () => {
    const projects = projectsDirectory();
    mkdirSync(path.join(projects, "-p-synqed"));
    const reported = path.join(projects, "-p-synqed", "70c7482b.jsonl");
    writeFileSync(reported, "{}\n");
    expect(await ClaudeConversationFile.find("70c7482b", reported, projects)).toBe(reported);
  });

  // Seen on 26 October 2026: after /resume from another folder the hooks reported a path under the
  // worktree, while Claude Code kept writing the conversation under the folder it started in.
  it("finds the conversation where Claude Code filed it when the reported path has no file", async () => {
    const projects = projectsDirectory();
    mkdirSync(path.join(projects, "-p-Whisker"));
    const real = path.join(projects, "-p-Whisker", "8fd9f8e2.jsonl");
    writeFileSync(real, "{}\n");
    expect(await ClaudeConversationFile.find("8fd9f8e2", path.join(projects, "-worktrees-Whisker-whisker-2", "8fd9f8e2.jsonl"), projects)).toBe(real);
  });

  it("finds nothing for a conversation that was never saved", async () => {
    expect(await ClaudeConversationFile.find("missing", undefined, projectsDirectory())).toBeUndefined();
  });
});

describe("ClaudeConversationFile.startFolderIn", () => {
  // Seen on 26 October 2026: whisker's agent had moved into the vault to write notes, so its last
  // entries named the vault, and Bring back opened it there instead of in its project.
  it("reads the folder the conversation started in, where Claude Code files it, not where its agent moved last", () => {
    const text = ['{"cwd":"/p/Whisker","type":"user"}', '{"cwd":"/p/Whisker","type":"assistant"}', '{"cwd":"/vault","type":"assistant"}', ""].join("\n");
    expect(ClaudeConversationFile.startFolderIn(text)).toBe("/p/Whisker");
  });

  it("skips entries before the first that names a folder", () => {
    expect(ClaudeConversationFile.startFolderIn('{"type":"summary"}\n{"cwd":"/p/whole"}\n')).toBe("/p/whole");
  });

  it("ignores a line cut off where the read stopped", () => {
    expect(ClaudeConversationFile.startFolderIn('{"type":"summary"}\n{"cwd":"/p/cu')).toBeUndefined();
  });

  it("finds nothing in a file with no folder", () => {
    expect(ClaudeConversationFile.startFolderIn('{"type":"summary"}\n')).toBeUndefined();
  });
});
