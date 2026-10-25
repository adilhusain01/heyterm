// Takes a snapshot of a session's folder in git when its task starts and another when it ends,
// so HeyTerm knows every file the task changed, edits made through shell commands included.
// Outside a git repository it knows nothing and says so with an empty list. Rules in turn-changes.ts.

import { execFile } from "node:child_process";
import { TurnChanges, type FolderSnapshot } from "./turn-changes.ts";
import type { TurnChangeTracking } from "./session-registry.ts";
import type { SessionView } from "../../shared/types.ts";

// The hook forwarder gives up after 3 seconds; a slow repository must not hold the Stop hook past it.
const gitTimeoutMilliseconds = 2_000;
const largestOutputBytes = 8 * 1024 * 1024;

export class TurnChangeTracker implements TurnChangeTracking {
  private readonly snapshotsAtTaskStart = new Map<string, Promise<FolderSnapshot | undefined>>();

  // Resolves once the snapshot is taken; the registry does not wait for it.
  taskStarted(session: SessionView): Promise<void> {
    const snapshot = TurnChangeTracker.take(session.projectPath);
    this.snapshotsAtTaskStart.set(TurnChangeTracker.key(session), snapshot);
    return snapshot.then(() => undefined);
  }

  async filesChangedByTask(session: SessionView): Promise<string[]> {
    const key = TurnChangeTracker.key(session);
    const before = await this.snapshotsAtTaskStart.get(key);
    this.snapshotsAtTaskStart.delete(key);
    if (!before) return [];
    const after = await TurnChangeTracker.take(session.projectPath);
    if (!after) return [];
    const committed = before.head !== after.head ? ((await git(session.projectPath, ["diff", "--name-only", "--relative", before.head, after.head])) ?? "").split("\n").filter(Boolean) : [];
    return TurnChanges.between(before, after, committed);
  }

  // Stays the same when the session is renamed.
  private static key(session: SessionView): string {
    return `${session.projectPath}|${session.createdAt}`;
  }

  private static async take(folder: string): Promise<FolderSnapshot | undefined> {
    const prefix = await git(folder, ["rev-parse", "--show-prefix"]);
    if (prefix === undefined) return undefined;
    const head = ((await git(folder, ["rev-parse", "HEAD"])) ?? "").trim() || "no commits yet";
    const status = await git(folder, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "."]);
    if (status === undefined) return undefined;
    const entries = parseStatus(status, prefix.trim());
    const present = entries.filter((entry) => !entry.deleted).map((entry) => entry.path);
    const hashes = present.length > 0 ? ((await git(folder, ["hash-object", "--stdin-paths"], present.join("\n"))) ?? "").split("\n") : [];
    const changedFiles = new Map<string, string>();
    for (const entry of entries) changedFiles.set(entry.path, entry.deleted ? "deleted" : (hashes[present.indexOf(entry.path)] ?? "unknown"));
    return { head, changedFiles };
  }
}

// `git status --porcelain -z`: "XY path\0", with a second path after a rename or copy. Paths are from
// the repository's top, so the folder's own prefix comes off.
function parseStatus(output: string, prefix: string): Array<{ path: string; deleted: boolean }> {
  const records = output.split("\0");
  const entries: Array<{ path: string; deleted: boolean }> = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    if (record.length < 4) continue;
    const code = record.slice(0, 2);
    const fullPath = record.slice(3);
    if (code.includes("R") || code.includes("C")) index += 1;
    if (!fullPath.startsWith(prefix)) continue;
    entries.push({ path: fullPath.slice(prefix.length), deleted: code.includes("D") });
  }
  return entries;
}

function git(folder: string, args: string[], input?: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = execFile("git", ["-C", folder, ...args], { timeout: gitTimeoutMilliseconds, maxBuffer: largestOutputBytes }, (error, stdout) => resolve(error ? undefined : stdout));
    if (input !== undefined) child.stdin?.end(input);
  });
}

