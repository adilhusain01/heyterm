// Puts HeyTerm's hooks where Grok Build and Cursor look for them, only while HeyTerm runs, and only
// for an agent that is installed: Grok's in a file of HeyTerm's own, Cursor's added to the user's
// ~/.cursor/hooks.json (backed up first) and taken out again when HeyTerm stops or is uninstalled.

import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GlobalAgentHooks } from "./global-agent-hooks.ts";
import { HookCommands } from "./hook-commands.ts";

export interface AgentHookPaths {
  grokPath: string;
  cursorPath: string;
}

// HEYTERM_GROK_HOOKS_PATH and HEYTERM_CURSOR_HOOKS_PATH point HeyTerm alone at other files, for tests.
export function agentHookPaths(): AgentHookPaths {
  return {
    grokPath: process.env.HEYTERM_GROK_HOOKS_PATH ?? path.join(process.env.GROK_HOME ?? path.join(os.homedir(), ".grok"), "hooks", "heyterm.json"),
    cursorPath: process.env.HEYTERM_CURSOR_HOOKS_PATH ?? path.join(os.homedir(), ".cursor", "hooks.json"),
  };
}

export class AgentHookFiles {
  private isInstalled = false;

  constructor(
    private readonly scriptPath: string,
    private readonly backupDirectory: string,
    private readonly paths: AgentHookPaths = agentHookPaths(),
  ) {}

  async install(): Promise<void> {
    this.isInstalled = true;
    await this.installGrok();
    await this.installCursor();
  }

  // While HeyTerm runs, something else may rewrite or delete these files (the agent itself, a second
  // copy of HeyTerm stopping). Puts HeyTerm's hooks back if they are gone; true when it did.
  async repairIfRemoved(): Promise<boolean> {
    if (!this.isInstalled) return false;
    let repaired = false;
    if ((await this.grokIsInstalled()) && !(await readFile(this.paths.grokPath, "utf8").catch(() => "")).includes(this.marker("Stop", "grok"))) {
      await this.installGrok();
      repaired = true;
    }
    if (await isFolder(path.dirname(this.paths.cursorPath))) {
      const current = await readJson(this.paths.cursorPath);
      if (current && !JSON.stringify(current).includes(this.marker("stop", "cursor"))) {
        await this.installCursor();
        repaired = true;
      }
    }
    return repaired;
  }

  async remove(): Promise<void> {
    this.isInstalled = false;
    await rm(this.paths.grokPath, { force: true });
    const current = await readJson(this.paths.cursorPath);
    if (!current || !current.hooks) return;
    const cleaned = GlobalAgentHooks.cursorWithoutHeyTerm(current, this.scriptPath);
    if (JSON.stringify(cleaned) === JSON.stringify(current)) return;
    // Only HeyTerm's hooks were in it, so the file goes: nothing of HeyTerm's stays behind.
    const holdsNothingElse = Object.keys(cleaned).every((key) => key === "version");
    if (holdsNothingElse) await rm(this.paths.cursorPath, { force: true });
    else await writeAtomically(this.paths.cursorPath, cleaned);
  }

  private async installGrok(): Promise<void> {
    if (!(await this.grokIsInstalled())) return;
    await mkdir(path.dirname(this.paths.grokPath), { recursive: true });
    await writeAtomically(this.paths.grokPath, GlobalAgentHooks.grokHookFile(this.scriptPath));
  }

  private async installCursor(): Promise<void> {
    if (!(await isFolder(path.dirname(this.paths.cursorPath)))) return;
    const current = await readJson(this.paths.cursorPath);
    if (!current) return;
    await this.backUp(this.paths.cursorPath);
    await writeAtomically(this.paths.cursorPath, GlobalAgentHooks.cursorWithHeyTerm(current, this.scriptPath));
  }

  // ~/.grok/hooks/heyterm.json: the agent's folder is two levels up.
  private grokIsInstalled(): Promise<boolean> {
    return isFolder(path.dirname(path.dirname(this.paths.grokPath)));
  }

  // One of HeyTerm's hook commands as it reads inside a JSON file, to tell whether its hooks are still there.
  private marker(eventName: string, agent: "grok" | "cursor"): string {
    return JSON.stringify(HookCommands.forAgent(this.scriptPath, eventName, agent)).slice(1, -1);
  }

  private async backUp(filePath: string): Promise<void> {
    await mkdir(this.backupDirectory, { recursive: true });
    await copyFile(filePath, path.join(this.backupDirectory, `cursor-hooks-${new Date().toISOString().replaceAll(":", "-")}.json`)).catch(() => undefined);
  }
}

async function isFolder(folder: string): Promise<boolean> {
  return stat(folder).then((info) => info.isDirectory(), () => false);
}

// A missing file reads as empty; one that is not JSON belongs to the user and is left alone.
async function readJson(filePath: string): Promise<Record<string, unknown> | undefined> {
  const text = await readFile(filePath, "utf8").catch((error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? "{}" : undefined));
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text || "{}") as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function writeAtomically(filePath: string, content: Record<string, unknown>): Promise<void> {
  const temporaryPath = `${filePath}.heyterm.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(content, null, 2)}\n`);
  await rename(temporaryPath, filePath);
}
