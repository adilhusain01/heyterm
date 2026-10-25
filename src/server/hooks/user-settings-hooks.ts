// Adds HeyTerm's hooks to, and removes them from, the user's own Claude Code settings, leaving
// everything else in the file exactly as it was. Pure: settings in, settings out.

import { HookCommands } from "./hook-commands.ts";
import { forwardedHookEvents, hookGroup } from "./hook-installer.ts";

type Settings = Record<string, unknown>;
type HookGroup = { hooks?: Array<{ command?: string }> };


export class UserSettingsHooks {
  static withHeyTerm(settings: Settings, scriptPath: string): Settings {
    const cleaned = UserSettingsHooks.withoutHeyTerm(settings);
    const hooks = { ...((cleaned.hooks as Record<string, HookGroup[]> | undefined) ?? {}) };
    for (const eventName of forwardedHookEvents) hooks[eventName] = [...(hooks[eventName] ?? []), hookGroup(HookCommands.forExistingSessions(scriptPath, eventName), eventName)];
    return { ...cleaned, hooks };
  }

  static withoutHeyTerm(settings: Settings): Settings {
    const hooks = settings.hooks as Record<string, HookGroup[]> | undefined;
    if (!hooks) return settings;
    const remaining: Record<string, HookGroup[]> = {};
    for (const [eventName, groups] of Object.entries(hooks)) {
      const kept = groups.filter((group) => !isHeyTermGroup(group));
      if (kept.length > 0) remaining[eventName] = kept;
    }
    const { hooks: _removedHooks, ...rest } = settings;
    return Object.keys(remaining).length > 0 ? { ...rest, hooks: remaining } : rest;
  }

  static isConnected(settings: Settings): boolean {
    const hooks = settings.hooks as Record<string, HookGroup[]> | undefined;
    return Object.values(hooks ?? {}).some((groups) => groups.some(isHeyTermGroup));
  }
}

function isHeyTermGroup(group: HookGroup): boolean {
  return (group.hooks ?? []).some((hook) => HookCommands.isHeyTerm(hook.command ?? ""));
}
