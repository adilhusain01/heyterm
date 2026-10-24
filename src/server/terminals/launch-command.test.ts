import { describe, expect, it } from "vitest";
import { LaunchCommand } from "./launch-command.ts";

describe("LaunchCommand.forPlatform", () => {
  it("runs through sh with exec on macOS and Linux, quoting every argument", () => {
    expect(LaunchCommand.forPlatform("claude", ["--settings", "/a b/it's.json", "-n", "web"], "darwin")).toEqual({
      file: "/bin/sh",
      args: ["-c", "exec 'claude' '--settings' '/a b/it'\\''s.json' '-n' 'web'"],
    });
  });

  it("runs through cmd on Windows, so claude.cmd and codex.cmd are found, with double quotes", () => {
    expect(LaunchCommand.forPlatform("claude", ["--settings", 'C:\\Users\\a b\\s.json'], "win32")).toEqual({
      file: "cmd.exe",
      args: ["/d", "/s", "/c", '"claude" "--settings" "C:\\Users\\a b\\s.json"'],
    });
  });

  it("refuses arguments that would let cmd run a second command", () => {
    expect(() => LaunchCommand.forPlatform("claude", ['x" & calc & "'], "win32")).toThrow();
  });
});
