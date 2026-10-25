// Where a Claude Code conversation is saved, and the folder it runs in. Claude Code files each
// conversation under the folder it started in (~/.claude/projects/<that folder>/<id>.jsonl) and
// keeps it there when /resume opens it from another folder, moving to the original folder, while
// its hooks report a path under the new one. Found on 26 October 2026: a session in a HeyTerm
// worktree took over a conversation from the main folder that way, Bring back found no file at the
// reported path, and started a blank Claude.

import { access, open, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// The last entries are enough to know the folder; the file itself can be tens of megabytes.
const tailBytes = 256 * 1024;

function claudeProjectsDirectory(): string {
  return path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude"), "projects");
}

export class ClaudeConversationFile {
  static async find(agentSessionId: string, reportedPath: string | undefined, projectsDirectory = claudeProjectsDirectory()): Promise<string | undefined> {
    if (reportedPath && (await exists(reportedPath))) return reportedPath;
    const projectFolders = await readdir(projectsDirectory).catch(() => [] as string[]);
    for (const projectFolder of projectFolders) {
      const candidate = path.join(projectsDirectory, projectFolder, `${agentSessionId}.jsonl`);
      if (await exists(candidate)) return candidate;
    }
    return undefined;
  }

  static async lastFolder(conversationFile: string): Promise<string | undefined> {
    const file = await open(conversationFile, "r").catch(() => undefined);
    if (!file) return undefined;
    try {
      const { size } = await file.stat();
      const length = Math.min(size, tailBytes);
      const buffer = Buffer.alloc(length);
      await file.read(buffer, 0, length, size - length);
      return ClaudeConversationFile.lastFolderIn(buffer.toString("utf8"));
    } finally {
      await file.close();
    }
  }

  // Each entry is one JSON line with the folder it ran in as "cwd". Pure.
  static lastFolderIn(text: string): string | undefined {
    const lines = text.split("\n");
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      let entry: unknown;
      try {
        entry = JSON.parse(lines[index]!);
      } catch {
        continue;
      }
      const folder = (entry as { cwd?: unknown } | null)?.cwd;
      if (typeof folder === "string" && folder) return folder;
    }
    return undefined;
  }
}

function exists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}
