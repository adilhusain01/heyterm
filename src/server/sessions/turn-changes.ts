// Which files a task changed, from two snapshots of its folder in git: one when the task started,
// one when it ended. Catches edits made through shell commands, which no edit hook reports. Pure.

export interface FolderSnapshot {
  head: string;
  // Each file git shows as changed or new, with a hash of its content (or "deleted").
  changedFiles: Map<string, string>;
}

export class TurnChanges {
  static between(before: FolderSnapshot, after: FolderSnapshot, committedDuringTask: string[]): string[] {
    const changed = new Set<string>();
    // Changed before and not now: reverted, deleted or committed.
    for (const file of before.changedFiles.keys()) if (!after.changedFiles.has(file)) changed.add(file);
    // New, or changed again since the task started.
    for (const [file, hash] of after.changedFiles) if (before.changedFiles.get(file) !== hash) changed.add(file);
    for (const file of committedDuringTask) changed.add(file);
    return [...changed];
  }
}
