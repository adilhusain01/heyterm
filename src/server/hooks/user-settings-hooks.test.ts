import { describe, expect, it } from "vitest";
import { UserSettingsHooks } from "./user-settings-hooks.ts";

const scriptPath = "/Users/dev/.callsign/hooks/callsign-forward.cjs";

const userOwnHook = { matcher: "Bash", hooks: [{ type: "command", command: "/Users/dev/bin/lint-guard.sh" }] };

describe("UserSettingsHooks.withCallsign", () => {
  it("adds one Callsign hook per forwarded event", () => {
    const settings = UserSettingsHooks.withCallsign({}, scriptPath);
    const hooks = settings.hooks as Record<string, unknown[]>;
    expect(Object.keys(hooks)).toContain("PermissionRequest");
    expect(JSON.stringify(hooks.Stop)).toContain("callsign-forward.cjs\\\" external Stop");
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

  it("also removes the hooks an older Callsign added as a shell script", () => {
    const olderEntry = { hooks: [{ type: "command", command: "'/Users/dev/.callsign/hooks/forward-existing-event.sh' Stop" }] };
    expect(UserSettingsHooks.withoutCallsign({ hooks: { Stop: [olderEntry] } })).toEqual({});
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
