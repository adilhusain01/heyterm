// `heyterm uninstall`: takes out everything HeyTerm put on this computer. Its hooks leave the
// user's Claude settings (everything else in the file stays), and its own folder goes to the Trash.

import { readFile, rename, writeFile } from "node:fs/promises";
import { UserSettingsHooks } from "../hooks/user-settings-hooks.ts";

interface UninstallerOptions {
  dataDirectory: string;
  claudeSettingsPath: string;
  moveToTrash: (target: string) => Promise<void>;
}

export interface UninstallReport {
  removedHooks: boolean;
  trashed: string[];
  leftBehind: string[];
}

export class Uninstaller {
  constructor(private readonly options: UninstallerOptions) {}

  async run(): Promise<UninstallReport> {
    const removedHooks = await this.removeHooks();
    const report: UninstallReport = { removedHooks, trashed: [], leftBehind: [] };
    try {
      await this.options.moveToTrash(this.options.dataDirectory);
      report.trashed.push(this.options.dataDirectory);
    } catch {
      report.leftBehind.push(this.options.dataDirectory);
    }
    return report;
  }

  private async removeHooks(): Promise<boolean> {
    const text = await readFile(this.options.claudeSettingsPath, "utf8").catch(() => undefined);
    if (text === undefined) return false;
    let settings: Record<string, unknown>;
    try {
      settings = JSON.parse(text || "{}") as Record<string, unknown>;
    } catch {
      return false;
    }
    if (!UserSettingsHooks.isConnected(settings)) return false;
    const temporaryPath = `${this.options.claudeSettingsPath}.heyterm.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(UserSettingsHooks.withoutHeyTerm(settings), null, 2)}\n`);
    await rename(temporaryPath, this.options.claudeSettingsPath);
    return true;
  }
}
