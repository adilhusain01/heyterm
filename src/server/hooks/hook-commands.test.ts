import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { HookCommands } from "./hook-commands.ts";

describe("HookCommands", () => {
  it("runs the forwarder with node for a session HeyTerm started", () => {
    expect(HookCommands.forSession("/data/hooks/heyterm-forward.cjs", "Stop")).toBe('node "/data/hooks/heyterm-forward.cjs" heyterm Stop');
  });

  it("does nothing, and fails nothing, in the user's own sessions once HeyTerm is gone", () => {
    const command = HookCommands.forExistingSessions("/no/such/place/heyterm-forward.cjs", "Stop");
    expect(() => execSync(command, { input: "{}", stdio: ["pipe", "pipe", "pipe"] })).not.toThrow();
    expect(execSync(command, { input: "{}" }).toString()).toBe("");
  });

  it("refuses a path that a shell would read as code", () => {
    expect(() => HookCommands.forSession('/data/$(rm -rf ~)/x.cjs', "Stop")).toThrow();
    expect(() => HookCommands.forSession('/data/"x.cjs', "Stop")).toThrow();
  });

  it("recognises its own commands, old and new, and nobody else's", () => {
    expect(HookCommands.isHeyTerm(HookCommands.forExistingSessions("/a/heyterm-forward.cjs", "Stop"))).toBe(true);
    expect(HookCommands.isHeyTerm("'/a/.heyterm/hooks/forward-existing-event.sh' Stop")).toBe(true);
    // From when it was called Callsign.
    expect(HookCommands.isHeyTerm('node -e "try{require(process.argv[1])}catch(e){}" "/a/.callsign/hooks/callsign-forward.cjs" external Stop')).toBe(true);
    expect(HookCommands.isHeyTerm("/Users/dev/bin/lint-guard.sh")).toBe(false);
  });
});
