import { describe, expect, it } from "vitest";
import { ShellRules } from "./shell-rules.ts";

describe("ShellRules.isCommandRunning", () => {
  it("sees the shell itself in front as no command running", () => {
    expect(ShellRules.isCommandRunning("zsh", "/bin/zsh")).toBe(false);
    expect(ShellRules.isCommandRunning("-zsh", "/bin/zsh")).toBe(false);
  });

  it("sees another program in front as a command still running", () => {
    expect(ShellRules.isCommandRunning("npm", "/bin/zsh")).toBe(true);
    expect(ShellRules.isCommandRunning("node", "/opt/homebrew/bin/fish")).toBe(true);
  });

  // Windows reports no foreground program; nothing can be said, so nothing is claimed.
  it("claims nothing when the foreground program is unknown", () => {
    expect(ShellRules.isCommandRunning(undefined, "cmd.exe")).toBe(false);
  });
});

describe("ShellRules.sessionName", () => {
  it("names a terminal after its folder, so it is told apart from the folder's agent", () => {
    expect(ShellRules.sessionName("synqed")).toBe("synqed-terminal");
  });
});

describe("ShellRules.variablesLeftOut", () => {
  // Seen on 26 October 2026: every HeyTerm terminal printed "Restored session", because HeyTerm was
  // first started in a Terminal.app tab and its shells took that tab's session id, so they would
  // restore and overwrite that tab's saved history.
  it("leaves out the variables that name another terminal app and its tab", () => {
    for (const name of ["TERM_SESSION_ID", "TERM_PROGRAM", "TERM_PROGRAM_VERSION", "ITERM_SESSION_ID"]) expect(ShellRules.variablesLeftOut).toContain(name);
  });
});
