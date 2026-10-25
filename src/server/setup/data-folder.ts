// HeyTerm keeps its things in ~/.heyterm. It was called Callsign before and used ~/.callsign; the
// first start moves that folder over, so sessions, choices and the token carry on.

import { rename, stat } from "node:fs/promises";
import path from "node:path";

export class DataFolder {
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
