// What the Setup screen reads and changes: installed tools, project folders, and whether the user's
// own Claude sessions are connected.

import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { AgentAdapters } from "../agents/agent-adapters.ts";
import type { ExistingSessionConnector } from "../hooks/existing-session-connector.ts";
import type { ProjectCatalog } from "../projects/project-catalog.ts";
import type { UserConfig } from "./user-config.ts";
import type { SetupStatus } from "../../shared/protocol.ts";

const execFileAsync = promisify(execFile);

// Every hook HeyTerm relies on was checked against this release on 24 October 2026.
export const testedClaudeVersion = "2.1.310";

export class SetupService {
  constructor(
    private readonly projects: ProjectCatalog,
    private readonly userConfig: UserConfig,
    private readonly connector: ExistingSessionConnector,
    private readonly routerModel: string,
  ) {}

  async status(): Promise<SetupStatus> {
    const [agents, projectList, existingSessionsConnected, saved] = await Promise.all([
      Promise.all(
        AgentAdapters.all().map(async (adapter) => ({
          kind: adapter.kind,
          label: adapter.label,
          installHint: adapter.installHint,
          version: await commandVersion(adapter.program, ["--version"], /(\d+\.\d+(?:\.\d+)?)/),
        })),
      ),
      this.projects.list(),
      this.connector.isConnected(),
      this.userConfig.load(),
    ]);
    const claudeVersion = agents.find((agent) => agent.kind === "claude")?.version;
    return {
      agents,
      claudeVersion,
      testedClaudeVersion,
      claudeVersionIsTested: claudeVersion !== undefined && compareVersions(claudeVersion, testedClaudeVersion) >= 0,
      nodeVersion: process.versions.node,
      projectRoots: this.projects.projectRoots,
      projectCount: projectList.length,
      existingSessionsConnected,
      routerSource: process.env.ANTHROPIC_API_KEY ? "api" : "claude-code",
      routerModel: this.routerModel,
      macVoiceAvailable: process.platform === "darwin",
      keepRunningWithoutPage: saved.keepRunningWithoutPage ?? false,
    };
  }

  // Keeps only folders that exist; "~" means the home folder.
  async setProjectRoots(roots: string[]): Promise<string[]> {
    const expanded = roots.map((root) => root.trim()).filter(Boolean).map(expandHome);
    const existing: string[] = [];
    for (const root of expanded) if (await isFolder(root)) existing.push(root);
    await this.userConfig.update({ projectRoots: existing });
    await this.projects.setRoots(existing);
    return expanded.filter((root) => !existing.includes(root));
  }

  async setExistingSessionsConnected(connected: boolean): Promise<void> {
    await this.userConfig.update({ showOwnTerminalSessions: connected });
    if (connected) await this.connector.connect();
    else await this.connector.disconnect();
  }

  async setKeepRunningWithoutPage(keepRunning: boolean): Promise<void> {
    await this.userConfig.update({ keepRunningWithoutPage: keepRunning });
  }
}

async function commandVersion(command: string, args: string[], pattern: RegExp): Promise<string | undefined> {
  // On Windows the agents are .cmd shims, which only a shell finds.
  const output = await execFileAsync(command, args, { timeout: 10_000, shell: process.platform === "win32" }).then(
    ({ stdout }) => stdout,
    () => "",
  );
  return pattern.exec(output)?.[1];
}

export function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function expandHome(folder: string): string {
  return folder === "~" || folder.startsWith("~/") ? path.join(os.homedir(), folder.slice(1)) : path.resolve(folder);
}

async function isFolder(folder: string): Promise<boolean> {
  return stat(folder).then((info) => info.isDirectory(), () => false);
}
