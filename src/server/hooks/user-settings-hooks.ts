// Adds Callsign's hooks to, and removes them from, the user's own Claude Code settings, leaving
// everything else in the file exactly as it was. Pure: settings in, settings out.

import { forwardedHookEvents, hookGroup } from "./hook-installer.ts";

type Settings = Record<string, unknown>;
type HookGroup = { hooks?: Array<{ command?: string }> };

// Every hook command Callsign adds runs this script, which is how its entries are told apart.
const callsignScriptName = "forward-existing-event.sh";

export class UserSettingsHooks {
  static withCallsign(settings: Settings, scriptPath: string): Settings {
    const cleaned = UserSettingsHooks.withoutCallsign(settings);
    const hooks = { ...((cleaned.hooks as Record<string, HookGroup[]> | undefined) ?? {}) };
    for (const eventName of forwardedHookEvents) hooks[eventName] = [...(hooks[eventName] ?? []), hookGroup(scriptPath, eventName)];
    return { ...cleaned, hooks };
  }

  static withoutCallsign(settings: Settings): Settings {
    const hooks = settings.hooks as Record<string, HookGroup[]> | undefined;
    if (!hooks) return settings;
    const remaining: Record<string, HookGroup[]> = {};
    for (const [eventName, groups] of Object.entries(hooks)) {
      const kept = groups.filter((group) => !isCallsignGroup(group));
      if (kept.length > 0) remaining[eventName] = kept;
    }
    const { hooks: _removedHooks, ...rest } = settings;
    return Object.keys(remaining).length > 0 ? { ...rest, hooks: remaining } : rest;
  }

  static isConnected(settings: Settings): boolean {
    const hooks = settings.hooks as Record<string, HookGroup[]> | undefined;
    return Object.values(hooks ?? {}).some((groups) => groups.some(isCallsignGroup));
  }
}

function isCallsignGroup(group: HookGroup): boolean {
  return (group.hooks ?? []).some((hook) => hook.command?.includes(callsignScriptName));
}
