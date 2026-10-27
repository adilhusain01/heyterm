// The folders a typed path could go on to, for starting a session in any folder from the picker,
// the way a path is completed in VS Code's Open Folder. Folders only; hidden ones only when the
// typed name starts with a dot. Paths in the home folder are shown starting with "~".

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { FolderSuggestionList } from "../../shared/protocol.ts";

const mostSuggestions = 30;

export class FolderSuggestions {
  static async list(typed: string, homeFolder: string): Promise<FolderSuggestionList> {
    const expanded = typed === "~" || /^~[\\/]/.test(typed) ? path.join(homeFolder, typed.slice(1)) : typed;
    const endsWithSeparator = /[\\/]$/.test(typed) || typed === "~";
    const parent = endsWithSeparator ? expanded : path.dirname(expanded);
    const partialName = endsWithSeparator ? "" : path.basename(expanded);
    const typedFolder = path.resolve(expanded);
    const isTypedFolder = await isFolder(typedFolder);
    const entries = await readdir(parent, { withFileTypes: true }).catch(() => undefined);
    if (!entries) return { suggestions: [] };
    const shown = (folderPath: string) => FolderSuggestions.shownPath(folderPath, homeFolder);
    const names: string[] = [];
    for (const entry of entries) {
      if (!entry.name.toLowerCase().startsWith(partialName.toLowerCase())) continue;
      if (entry.name.startsWith(".") && !partialName.startsWith(".")) continue;
      // Links to folders count too: some project folders are symbolic links.
      const isEntryFolder = entry.isDirectory() || (entry.isSymbolicLink() && (await isFolder(path.join(parent, entry.name))));
      if (isEntryFolder) names.push(entry.name);
    }
    const suggestions = names
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
      .slice(0, mostSuggestions)
      .map((name) => ({ path: path.resolve(parent, name), shownPath: shown(path.resolve(parent, name)) }));
    return { ...(isTypedFolder ? { folder: { path: typedFolder, shownPath: shown(typedFolder) } } : {}), suggestions };
  }

  static shownPath(folderPath: string, homeFolder: string): string {
    const relative = path.relative(homeFolder, folderPath);
    if (relative === "") return "~";
    if (relative.startsWith("..") || path.isAbsolute(relative)) return folderPath;
    return `~/${relative.split(path.sep).join("/")}`;
  }
}

async function isFolder(folderPath: string): Promise<boolean> {
  return stat(folderPath).then((info) => info.isDirectory(), () => false);
}
