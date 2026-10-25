import { describe, expect, it } from "vitest";
import { UserSettingsHooks } from "./user-settings-hooks.ts";

const scriptPath = "/Users/dev/.heyterm/hooks/heyterm-forward.cjs";

const userOwnHook = { matcher: "Bash", hooks: [{ type: "command", command: "/Users/dev/bin/lint-guard.sh" }] };

describe("UserSettingsHooks.withHeyTerm", () => {
  it("adds one HeyTerm hook per forwarded event", () => {
    const settings = UserSettingsHooks.withHeyTerm({}, scriptPath);
    const hooks = settings.hooks as Record<string, unknown[]>;
    expect(Object.keys(hooks)).toContain("PermissionRequest");
    expect(JSON.stringify(hooks.Stop)).toContain("heyterm-forward.cjs\\\" external Stop");
  });

  it("keeps every other setting and the user's own hooks", () => {
    const settings = UserSettingsHooks.withHeyTerm({ model: "claude-opus-5-5", hooks: { PreToolUse: [userOwnHook] } }, scriptPath);
    expect(settings.model).toBe("claude-opus-5-5");
    const preToolUse = (settings.hooks as Record<string, unknown[]>).PreToolUse!;
    expect(preToolUse).toContainEqual(userOwnHook);
    expect(preToolUse).toHaveLength(2);
  });

  it("adds nothing twice when run again", () => {
    const once = UserSettingsHooks.withHeyTerm({}, scriptPath);
    const twice = UserSettingsHooks.withHeyTerm(once, scriptPath);
    expect(twice).toEqual(once);
  });
});

describe("UserSettingsHooks.withoutHeyTerm", () => {
  it("removes only HeyTerm's hooks and leaves the user's", () => {
    const connected = UserSettingsHooks.withHeyTerm({ theme: "dark", hooks: { PreToolUse: [userOwnHook] } }, scriptPath);
    expect(UserSettingsHooks.withoutHeyTerm(connected)).toEqual({ theme: "dark", hooks: { PreToolUse: [userOwnHook] } });
  });

  it("also removes the hooks an older HeyTerm added as a shell script", () => {
    const olderEntry = { hooks: [{ type: "command", command: "'/Users/dev/.heyterm/hooks/forward-existing-event.sh' Stop" }] };
    expect(UserSettingsHooks.withoutHeyTerm({ hooks: { Stop: [olderEntry] } })).toEqual({});
  });

  it("drops the hooks key when nothing else was in it", () => {
    const connected = UserSettingsHooks.withHeyTerm({ theme: "dark" }, scriptPath);
    expect(UserSettingsHooks.withoutHeyTerm(connected)).toEqual({ theme: "dark" });
  });
});

describe("UserSettingsHooks.isConnected", () => {
  it("tells whether HeyTerm's hooks are in the settings", () => {
    expect(UserSettingsHooks.isConnected({})).toBe(false);
    expect(UserSettingsHooks.isConnected(UserSettingsHooks.withHeyTerm({}, scriptPath))).toBe(true);
  });
});
