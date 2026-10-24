import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { HookCommands } from "./hook-commands.ts";

describe("HookCommands", () => {
  it("runs the forwarder with node for a session Callsign started", () => {
    expect(HookCommands.forSession("/data/hooks/callsign-forward.cjs", "Stop")).toBe('node "/data/hooks/callsign-forward.cjs" callsign Stop');
  });

  it("does nothing, and fails nothing, in the user's own sessions once Callsign is gone", () => {
    const command = HookCommands.forExistingSessions("/no/such/place/callsign-forward.cjs", "Stop");
    expect(() => execSync(command, { input: "{}", stdio: ["pipe", "pipe", "pipe"] })).not.toThrow();
    expect(execSync(command, { input: "{}" }).toString()).toBe("");
  });

  it("refuses a path that a shell would read as code", () => {
    expect(() => HookCommands.forSession('/data/$(rm -rf ~)/x.cjs', "Stop")).toThrow();
    expect(() => HookCommands.forSession('/data/"x.cjs', "Stop")).toThrow();
  });

  it("recognises its own commands, old and new, and nobody else's", () => {
    expect(HookCommands.isCallsign(HookCommands.forExistingSessions("/a/callsign-forward.cjs", "Stop"))).toBe(true);
    expect(HookCommands.isCallsign("'/a/.callsign/hooks/forward-existing-event.sh' Stop")).toBe(true);
    expect(HookCommands.isCallsign("/Users/dev/bin/lint-guard.sh")).toBe(false);
  });
});
