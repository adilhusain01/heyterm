// HeyTerm keeps its things in ~/.heyterm. It was called Callsign before and used ~/.callsign; the
// first start moves that folder over, so sessions, choices and the token carry on.

import { chmod, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

export class DataFolder {
  // Readable by this user alone: it holds the token, the audit log and backups of Claude settings.
  static async ensurePrivate(folder: string): Promise<void> {
    await mkdir(folder, { recursive: true, mode: 0o700 });
    if (process.platform !== "win32") await chmod(folder, 0o700);
  }

  static async moveFromOldName(home: string): Promise<void> {
    const oldFolder = path.join(home, ".callsign");
    const newFolder = path.join(home, ".heyterm");
    if (!(await isFolder(oldFolder)) || (await exists(newFolder))) return;
    await rename(oldFolder, newFolder);
  }
}

async function isFolder(target: string): Promise<boolean> {
  return stat(target).then(
    (info) => info.isDirectory(),
    () => false,
  );
}

async function exists(target: string): Promise<boolean> {
  return stat(target).then(
    () => true,
    () => false,
  );
}
