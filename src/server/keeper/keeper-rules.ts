// What the terminal keeper does when the server it runs exits. Stopping on purpose ends the
// terminals; anything else starts the server again and keeps them, so a crash or an update never
// takes the sessions with it. Pure.

export type AfterServerExit = { kind: "end_terminals" } | { kind: "restart"; afterMilliseconds: number };

// Waits after the first, second, third and every later crash in the last two minutes.
const crashDelaysMilliseconds = [500, 2_000, 5_000, 30_000];
const crashMemoryMilliseconds = 2 * 60_000;

export class KeeperRules {
  // The exit code a server uses to ask for a fresh start (sysexits' "temporary failure").
  static readonly restartExitCode = 75;

  // exitCode is null when the server was killed by a signal.
  static afterServerExit({ exitCode, recentCrashTimes, now }: { exitCode: number | null; recentCrashTimes: number[]; now: number }): AfterServerExit {
    if (exitCode === 0) return { kind: "end_terminals" };
    if (exitCode === KeeperRules.restartExitCode) return { kind: "restart", afterMilliseconds: 0 };
    const earlierCrashes = recentCrashTimes.filter((time) => now - time < crashMemoryMilliseconds).length;
    return { kind: "restart", afterMilliseconds: crashDelaysMilliseconds[Math.min(earlierCrashes, crashDelaysMilliseconds.length - 1)]! };
  }

  static recentCrashes(crashTimes: number[], now: number): number[] {
    return crashTimes.filter((time) => now - time < crashMemoryMilliseconds);
  }
}
