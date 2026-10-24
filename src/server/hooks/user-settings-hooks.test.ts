import { describe, expect, it } from "vitest";
import { UserSettingsHooks } from "./user-settings-hooks.ts";

const scriptPath = "/Users/dev/.callsign/hooks/forward-existing-event.sh";

const userOwnHook = { matcher: "Bash", hooks: [{ type: "command", command: "/Users/dev/bin/lint-guard.sh" }] };

describe("UserSettingsHooks.withCallsign", () => {
  it("adds one Callsign hook per forwarded event", () => {
    const settings = UserSettingsHooks.withCallsign({}, scriptPath);
    const hooks = settings.hooks as Record<string, unknown[]>;
    expect(Object.keys(hooks)).toContain("PermissionRequest");
    expect(JSON.stringify(hooks.Stop)).toContain(`${scriptPath}' Stop`);
  });

  it("keeps every other setting and the user's own hooks", () => {
    const settings = UserSettingsHooks.withCallsign({ model: "claude-opus-5-5", hooks: { PreToolUse: [userOwnHook] } }, scriptPath);
    expect(settings.model).toBe("claude-opus-5-5");
    const preToolUse = (settings.hooks as Record<string, unknown[]>).PreToolUse!;
    expect(preToolUse).toContainEqual(userOwnHook);
    expect(preToolUse).toHaveLength(2);
  });

  it("adds nothing twice when run again", () => {
    const once = UserSettingsHooks.withCallsign({}, scriptPath);
    const twice = UserSettingsHooks.withCallsign(once, scriptPath);
    expect(twice).toEqual(once);
  });
});

describe("UserSettingsHooks.withoutCallsign", () => {
  it("removes only Callsign's hooks and leaves the user's", () => {
    const connected = UserSettingsHooks.withCallsign({ theme: "dark", hooks: { PreToolUse: [userOwnHook] } }, scriptPath);
    expect(UserSettingsHooks.withoutCallsign(connected)).toEqual({ theme: "dark", hooks: { PreToolUse: [userOwnHook] } });
  });

  it("drops the hooks key when nothing else was in it", () => {
    const connected = UserSettingsHooks.withCallsign({ theme: "dark" }, scriptPath);
    expect(UserSettingsHooks.withoutCallsign(connected)).toEqual({ theme: "dark" });
  });
});

describe("UserSettingsHooks.isConnected", () => {
  it("tells whether Callsign's hooks are in the settings", () => {
    expect(UserSettingsHooks.isConnected({})).toBe(false);
    expect(UserSettingsHooks.isConnected(UserSettingsHooks.withCallsign({}, scriptPath))).toBe(true);
  });
});
