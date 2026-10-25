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

describe("ClaudeConversationFile.lastFolderIn", () => {
  it("reads the folder of the last entry that names one", () => {
    const text = ['{"cwd":"/p/first","type":"user"}', '{"cwd":"/p/Whisker","type":"assistant"}', '{"type":"summary"}', ""].join("\n");
    expect(ClaudeConversationFile.lastFolderIn(text)).toBe("/p/Whisker");
  });

  it("skips a line cut in half where the read started", () => {
    expect(ClaudeConversationFile.lastFolderIn('wd":"/p/broken"}\n{"cwd":"/p/whole"}\n{"cwd":"/p/cut')).toBe("/p/whole");
  });

  it("finds nothing in a file with no folder", () => {
    expect(ClaudeConversationFile.lastFolderIn('{"type":"summary"}\n')).toBeUndefined();
  });
});
