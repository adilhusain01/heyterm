// The git repositories under the project folders, so "start a session in portfolio" finds the right one.

import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface ProjectEntry {
  name: string;
  path: string;
}

const deepestFolderLevel = 3;
const skippedFolders = new Set(["node_modules", "dist", "build", "vendor", "Pods", "DerivedData", "target"]);
const refreshMilliseconds = 5 * 60_000;

export class ProjectCatalog {
  private projects: ProjectEntry[] = [];
  private refreshedAt = 0;

  constructor(private roots: string[]) {}

  get projectRoots(): string[] {
    return this.roots;
  }

  async setRoots(roots: string[]): Promise<void> {
    this.roots = roots;
    await this.refresh();
  }

  async list(): Promise<ProjectEntry[]> {
    if (Date.now() - this.refreshedAt > refreshMilliseconds) await this.refresh();
    return this.projects;
  }

  // A listed project by name, or any existing folder by its path ("~/Documents/Projects").
  async find(nameOrPath: string): Promise<ProjectEntry | undefined> {
    const listed = (await this.list()).find((project) => project.name === nameOrPath);
    if (listed) return listed;
    if (!looksLikePath(nameOrPath)) return undefined;
    const folder = path.resolve(nameOrPath.replace(/^~(?=$|[\\/])/, os.homedir()));
    const isFolder = await stat(folder).then((info) => info.isDirectory(), () => false);
    return isFolder ? { name: path.basename(folder).toLowerCase() || "root", path: folder } : undefined;
  }

  async refresh(): Promise<void> {
    const found: ProjectEntry[] = [];
    for (const root of this.roots) await collectRepositories(root, 0, found);
    this.projects = withUniqueNames(found);
    this.refreshedAt = Date.now();
  }
}

function looksLikePath(text: string): boolean {
  return text.startsWith("~") || path.isAbsolute(text) || text.includes("/") || text.includes("\\");
}

async function collectRepositories(folder: string, level: number, found: ProjectEntry[]): Promise<void> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  if (entries.some((entry) => entry.name === ".git")) {
    found.push({ name: path.basename(folder), path: folder });
    return;
  }
  if (level >= deepestFolderLevel) return;
  for (const entry of entries) {
    if (entry.name.startsWith(".") || skippedFolders.has(entry.name)) continue;
    const childPath = path.join(folder, entry.name);
    // Follow links to folders too: some project folders are symbolic links.
    const isFolder = entry.isDirectory() || (entry.isSymbolicLink() && (await stat(childPath).then((info) => info.isDirectory(), () => false)));
    if (isFolder) await collectRepositories(childPath, level + 1, found);
  }
}

// Two repositories called "web" become "web" and "parent-web".
function withUniqueNames(projects: ProjectEntry[]): ProjectEntry[] {
  const seen = new Set<string>();
  return projects.map((project) => {
    const baseName = project.name.toLowerCase();
    const name = seen.has(baseName) ? `${path.basename(path.dirname(project.path)).toLowerCase()}-${baseName}` : baseName;
    seen.add(name);
    return { ...project, name };
  });
}
