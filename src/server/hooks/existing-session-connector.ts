// Connects the Claude sessions a user starts in their own terminals, by adding Callsign's hooks to
// ~/.claude/settings.json. Only on the user's click; the file is backed up first, and disconnecting
// removes exactly what was added. Claude Code reloads hooks itself, so running sessions join too.

import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { UserSettingsHooks } from "./user-settings-hooks.ts";

// The user's own Claude Code settings file. CALLSIGN_CLAUDE_SETTINGS_PATH points Callsign alone at
// another file, for tests, without changing where the agents themselves look.
export function claudeUserSettingsPath(): string {
  return process.env.CALLSIGN_CLAUDE_SETTINGS_PATH ?? path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude"), "settings.json");
}

export class ExistingSessionConnector {
  private readonly settingsPath = claudeUserSettingsPath();

  constructor(
    private readonly scriptPath: string,
    private readonly backupDirectory: string,
  ) {}

  async isConnected(): Promise<boolean> {
    const settings = await this.readSettings().catch(() => ({}));
    return UserSettingsHooks.isConnected(settings);
  }

  async connect(): Promise<void> {
    const settings = await this.readSettings();
    await this.writeSettings(UserSettingsHooks.withCallsign(settings, this.scriptPath));
  }

  async disconnect(): Promise<void> {
    const settings = await this.readSettings();
    await this.writeSettings(UserSettingsHooks.withoutCallsign(settings));
  }

  // A file that is not valid JSON is refused rather than overwritten: it belongs to the user.
  private async readSettings(): Promise<Record<string, unknown>> {
    const text = await readFile(this.settingsPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "{}";
      throw error;
    });
    try {
      return JSON.parse(text || "{}") as Record<string, unknown>;
    } catch {
      throw new Error(`${this.settingsPath} is not valid JSON, so Callsign left it alone. Fix it and try again.`);
    }
  }

  private async writeSettings(settings: Record<string, unknown>): Promise<void> {
    await mkdir(this.backupDirectory, { recursive: true });
    const backupPath = path.join(this.backupDirectory, `claude-settings-${new Date().toISOString().replaceAll(":", "-")}.json`);
    await copyFile(this.settingsPath, backupPath).catch(() => undefined);
    await mkdir(path.dirname(this.settingsPath), { recursive: true });
    const temporaryPath = `${this.settingsPath}.callsign.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`);
    await rename(temporaryPath, this.settingsPath);
  }
}
