// A folder named out loud ("open a terminal in downloads"): not a project and not a path, so it is
// looked for by name in the home folder, a few levels down. The shallowest matches win; when there
// are several, they are all named so the assistant can ask which one.

import { readdir } from "node:fs/promises";
import path from "node:path";

const deepestLevel = 3;
const skippedFolders = new Set(["node_modules", "dist", "build", "vendor", "Pods", "DerivedData", "target", "Library"]);

export class FolderByName {
  static async find(name: string, homeFolder: string): Promise<{ found?: string; several?: string[] }> {
    const wanted = name.trim().toLowerCase();
    if (!wanted) return {};
    let level: string[] = [homeFolder];
    for (let depth = 1; depth <= deepestLevel && level.length > 0; depth += 1) {
      const matches: string[] = [];
      const next: string[] = [];
      for (const folder of level) {
        const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith(".") || skippedFolders.has(entry.name)) continue;
          const child = path.join(folder, entry.name);
          if (entry.name.toLowerCase() === wanted) matches.push(child);
          next.push(child);
        }
      }
      if (matches.length === 1) return { found: matches[0] };
      if (matches.length > 1) return { several: matches.sort() };
      level = next;
    }
    return {};
  }
}
