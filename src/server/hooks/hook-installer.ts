// Writes the hook script and the Claude Code settings file that Callsign starts every session with.

import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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

// Claude Code waits up to 600 seconds for a hook; Callsign answers or lets go before that.
export const permissionHookTimeoutSeconds = 590;

export interface InstalledHooks {
  settingsPath: string;
  // The script the user's own Claude settings run once they connect existing sessions.
  existingSessionScriptPath: string;
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
    const scriptPath = await writeScript(path.join(hooksDirectory, "forward-event.sh"), hookScript(this.port, token, "callsign"));
    const existingSessionScriptPath = await writeScript(path.join(hooksDirectory, "forward-existing-event.sh"), hookScript(this.port, token, "external"));
    const settingsPath = path.join(hooksDirectory, "claude-settings.json");
    await writeFile(settingsPath, JSON.stringify(claudeSettings(scriptPath), null, 2), { mode: 0o600 });
    return { settingsPath, existingSessionScriptPath, token };
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

function claudeSettings(scriptPath: string): Record<string, unknown> {
  return { hooks: Object.fromEntries(forwardedHookEvents.map((eventName) => [eventName, [hookGroup(scriptPath, eventName)]])) };
}

// One settings entry that runs the script for one event.
export function hookGroup(scriptPath: string, eventName: HookEventName): { hooks: Array<{ type: string; command: string; timeout: number }> } {
  const timeout = eventName === "PermissionRequest" ? permissionHookTimeoutSeconds + 5 : 10;
  return { hooks: [{ type: "command", command: `${shellQuote(scriptPath)} ${eventName}`, timeout }] };
}

async function writeScript(scriptPath: string, contents: string): Promise<string> {
  await writeFile(scriptPath, contents, { mode: 0o700 });
  await chmod(scriptPath, 0o700);
  return scriptPath;
}

// Sends one event to Callsign and prints Callsign's answer. When Callsign is not running it prints
// nothing, so Claude Code carries on as if no hook existed.
// The "callsign" script runs only in sessions Callsign started; the "external" one, from the user's own
// settings, runs only in the others, so no session ever reports twice.
function hookScript(port: number, token: string, origin: "callsign" | "external"): string {
  const sessionCheck = origin === "callsign" ? '[ -n "$CALLSIGN_SESSION" ] || exit 0' : '[ -z "$CALLSIGN_SESSION" ] && [ -z "$CALLSIGN_ROUTER" ] || exit 0';
  const query = origin === "callsign" ? "session=$CALLSIGN_SESSION" : "external=1";
  return `#!/bin/sh
# Written by Callsign. Forwards one Claude Code hook event to Callsign on this computer.
${sessionCheck}
event="$1"
seconds=3
[ "$event" = "PermissionRequest" ] && seconds=${permissionHookTimeoutSeconds}
curl -s --max-time "$seconds" -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-Callsign-Token: ${token}" \\
  --data-binary @- \\
  "http://127.0.0.1:${port}/hooks/$event?${query}" 2>/dev/null
exit 0
`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
