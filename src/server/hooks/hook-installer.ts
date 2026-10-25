// Writes the hook forwarder and the Claude Code settings file that HeyTerm starts every session with.

import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { forwardScript, permissionWaitSeconds } from "./forward-script.ts";
import { forwardScriptName, HookCommands } from "./hook-commands.ts";
import type { HookEventName } from "../../shared/types.ts";

export const forwardedHookEvents: HookEventName[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "Stop",
  "StopFailure",
  "SessionEnd",
];

// Claude Code waits up to 600 seconds for a hook; HeyTerm answers or lets go before that.
export const permissionHookTimeoutSeconds = permissionWaitSeconds;

export interface InstalledHooks {
  settingsPath: string;
  // The forwarder every hook runs, for HeyTerm's sessions and the user's own.
  forwardScriptPath: string;
  token: string;
}

export class HookInstaller {
  constructor(
    private readonly dataDirectory: string,
    private readonly port: number,
  ) {}

  async install(): Promise<InstalledHooks> {
    const hooksDirectory = path.join(this.dataDirectory, "hooks");
    await mkdir(hooksDirectory, { recursive: true, mode: 0o700 });
    const token = await this.loadOrCreateToken();
    const forwardScriptPath = path.join(hooksDirectory, forwardScriptName);
    await writeFile(forwardScriptPath, forwardScript(this.port, token), { mode: 0o600 });
    await chmod(forwardScriptPath, 0o600).catch(() => undefined);
    // Scripts from older versions; their entries in the user's settings are cleaned up on connect.
    for (const olderScript of ["forward-event.sh", "forward-existing-event.sh"]) await rm(path.join(hooksDirectory, olderScript), { force: true });
    const settingsPath = path.join(hooksDirectory, "claude-settings.json");
    await writeFile(settingsPath, JSON.stringify(claudeSettings(forwardScriptPath), null, 2), { mode: 0o600 });
    return { settingsPath, forwardScriptPath, token };
  }

  private async loadOrCreateToken(): Promise<string> {
    const tokenPath = path.join(this.dataDirectory, "token");
    const existing = await readFile(tokenPath, "utf8").catch(() => "");
    if (existing.trim()) return existing.trim();
    const token = randomBytes(24).toString("hex");
    await writeFile(tokenPath, token, { mode: 0o600 });
    return token;
  }
}

function claudeSettings(forwardScriptPath: string): Record<string, unknown> {
  return {
    hooks: Object.fromEntries(forwardedHookEvents.map((eventName) => [eventName, [hookGroup(HookCommands.forSession(forwardScriptPath, eventName), eventName)]])),
  };
}

// One settings entry that runs one command for one event.
export function hookGroup(command: string, eventName: HookEventName): { hooks: Array<{ type: string; command: string; timeout: number }> } {
  const timeout = eventName === "PermissionRequest" ? permissionHookTimeoutSeconds + 5 : 10;
  return { hooks: [{ type: "command", command, timeout }] };
}
