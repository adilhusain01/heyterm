import { describe, expect, it } from "vitest";
import { QuietRules } from "./quiet-rules.ts";
import type { SessionView } from "../../shared/types.ts";

const minute = 60_000;

function working(overrides: Partial<SessionView>): SessionView {
  return { name: "api", projectPath: "/p/api", projectName: "api", agent: "claude", state: "working", stateSince: 0, createdAt: 0, lastSeenAt: 0, activitySinceSeen: [], waitedMillisecondsToday: 0, lastActivityAt: 0, ...overrides };
}

describe("QuietRules.verdict", () => {
  it("calls a working session quiet after five minutes without a word from it", () => {
    expect(QuietRules.verdict(working({}), 5 * minute)).toEqual({ kind: "quiet", since: 0 });
    expect(QuietRules.verdict(working({}), 4 * minute)).toBeUndefined();
  });

  // A build or a test run can take long; that is not the same as being stuck.
  it("gives a running command ten minutes and says it is a command", () => {
    const running = working({ runningCommand: { text: "pnpm test", since: 0 } });
    expect(QuietRules.verdict(running, 6 * minute)).toBeUndefined();
    expect(QuietRules.verdict(running, 10 * minute)).toEqual({ kind: "long_command", since: 0 });
  });

  it("counts from the last thing the session did", () => {
    expect(QuietRules.verdict(working({ lastActivityAt: 3 * minute }), 6 * minute)).toBeUndefined();
  });

  it("says nothing about a session that is not working, or already said to be quiet", () => {
    expect(QuietRules.verdict(working({ state: "idle" }), 60 * minute)).toBeUndefined();
    expect(QuietRules.verdict(working({ state: "needs_permission" }), 60 * minute)).toBeUndefined();
    expect(QuietRules.verdict(working({ quiet: { kind: "quiet", since: 0 } }), 60 * minute)).toBeUndefined();
  });
});
