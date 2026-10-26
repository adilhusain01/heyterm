import { describe, expect, it } from "vitest";
import { KeeperRules } from "./keeper-rules.ts";

const minute = 60_000;

describe("KeeperRules.afterServerExit", () => {
  it("ends every terminal when the server stopped on purpose (heyterm stop, Quit, the page closed)", () => {
    expect(KeeperRules.afterServerExit({ exitCode: 0, recentCrashTimes: [], now: 0 })).toEqual({ kind: "end_terminals" });
  });

  it("starts the server again at once when it asked for a restart", () => {
    expect(KeeperRules.afterServerExit({ exitCode: KeeperRules.restartExitCode, recentCrashTimes: [], now: 0 })).toEqual({ kind: "restart", afterMilliseconds: 0 });
  });

  // A crash must never take the sessions with it: they keep running and the server comes back.
  it("starts a crashed server again, waiting longer after each crash, and never ends the terminals", () => {
    const now = 10 * minute;
    expect(KeeperRules.afterServerExit({ exitCode: 1, recentCrashTimes: [], now })).toEqual({ kind: "restart", afterMilliseconds: 500 });
    expect(KeeperRules.afterServerExit({ exitCode: 1, recentCrashTimes: [now - 1_000], now })).toEqual({ kind: "restart", afterMilliseconds: 2_000 });
    expect(KeeperRules.afterServerExit({ exitCode: null, recentCrashTimes: [now - 3_000, now - 2_000], now })).toEqual({ kind: "restart", afterMilliseconds: 5_000 });
    expect(KeeperRules.afterServerExit({ exitCode: 1, recentCrashTimes: [now - 9_000, now - 6_000, now - 3_000, now - 1_000], now })).toEqual({ kind: "restart", afterMilliseconds: 30_000 });
  });

  it("forgets crashes older than two minutes", () => {
    const now = 10 * minute;
    expect(KeeperRules.afterServerExit({ exitCode: 1, recentCrashTimes: [now - 3 * minute, now - 2.5 * minute], now })).toEqual({ kind: "restart", afterMilliseconds: 500 });
  });
});
