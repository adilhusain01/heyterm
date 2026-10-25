import { describe, expect, it } from "vitest";
import { ClaudeSessionStatus, type ClaudeSessionRecord } from "./claude-session-status.ts";
import type { SessionView } from "../../shared/types.ts";

const minute = 60_000;

function session(overrides: Partial<SessionView>): SessionView {
  return {
    name: "synqed",
    origin: "external",
    projectPath: "/p/synqed",
    projectName: "synqed",
    agent: "claude",
    state: "working",
    stateSince: 10 * minute,
    createdAt: 0,
    lastSeenAt: 0,
    agentSessionId: "70c7482b",
    activitySinceSeen: [],
    waitedMillisecondsToday: 0,
    ...overrides,
  };
}

function record(overrides: Partial<ClaudeSessionRecord>): ClaudeSessionRecord {
  return { pid: 8515, sessionId: "70c7482b", status: "busy", statusUpdatedAt: 10 * minute, ...overrides };
}

describe("ClaudeSessionStatus.verdict", () => {
  // Seen on 25 October 2026: Adil stopped a turn; Claude Code sends no Stop hook for an interrupt,
  // so HeyTerm showed the session working while its own record said "shell".
  it("sees a turn the user stopped once Claude Code's record stops saying busy", () => {
    expect(ClaudeSessionStatus.verdict(session({}), record({ status: "shell", statusUpdatedAt: 12 * minute }), true, 13 * minute)).toBe("turn_stopped");
    expect(ClaudeSessionStatus.verdict(session({}), record({ status: "idle", statusUpdatedAt: 12 * minute }), true, 13 * minute)).toBe("turn_stopped");
  });

  it("sees a permission or question the user dismissed in their terminal", () => {
    expect(ClaudeSessionStatus.verdict(session({ state: "needs_permission" }), record({ status: "idle", statusUpdatedAt: 12 * minute }), true, 13 * minute)).toBe("turn_stopped");
    expect(ClaudeSessionStatus.verdict(session({ state: "asked" }), record({ status: "idle", statusUpdatedAt: 12 * minute }), true, 13 * minute)).toBe("turn_stopped");
  });

  it("leaves a busy session working", () => {
    expect(ClaudeSessionStatus.verdict(session({}), record({ status: "busy", statusUpdatedAt: 12 * minute }), true, 13 * minute)).toBeUndefined();
  });

  it("leaves a session waiting on the user alone", () => {
    expect(ClaudeSessionStatus.verdict(session({}), record({ status: "waiting", statusUpdatedAt: 12 * minute }), true, 13 * minute)).toBeUndefined();
  });

  it("does not trust an idle record older than the prompt that started the turn", () => {
    expect(ClaudeSessionStatus.verdict(session({}), record({ status: "idle", statusUpdatedAt: 9 * minute }), true, 13 * minute)).toBeUndefined();
  });

  it("gives the Stop hook a moment to arrive after the record turns idle", () => {
    expect(ClaudeSessionStatus.verdict(session({}), record({ status: "idle", statusUpdatedAt: 12 * minute }), true, 12 * minute + 1000)).toBeUndefined();
  });

  it("leaves an idle or finished session as it is", () => {
    expect(ClaudeSessionStatus.verdict(session({ state: "idle" }), record({ status: "idle", statusUpdatedAt: 12 * minute }), true, 13 * minute)).toBeUndefined();
    expect(ClaudeSessionStatus.verdict(session({ state: "done" }), record({ status: "idle", statusUpdatedAt: 12 * minute }), true, 13 * minute)).toBeUndefined();
  });

  // Seen the same day: synqed-3 stayed in the list with no Claude process and no record behind it.
  it("ends a session from the user's own terminal once its record is gone", () => {
    expect(ClaudeSessionStatus.verdict(session({ state: "idle" }), undefined, false, 13 * minute)).toBe("ended");
  });

  it("ends a session whose record outlived its process", () => {
    expect(ClaudeSessionStatus.verdict(session({}), record({}), false, 13 * minute)).toBe("ended");
  });

  it("waits before ending a session that only just appeared", () => {
    expect(ClaudeSessionStatus.verdict(session({ state: "idle", stateSince: 13 * minute - 5000 }), undefined, false, 13 * minute)).toBeUndefined();
  });

  it("leaves sessions HeyTerm started to their own terminal, which reports their end", () => {
    expect(ClaudeSessionStatus.verdict(session({ origin: "heyterm" }), undefined, false, 13 * minute)).toBeUndefined();
  });

  it("applies only to Claude Code sessions it can identify", () => {
    expect(ClaudeSessionStatus.verdict(session({ agent: "grok" }), undefined, false, 13 * minute)).toBeUndefined();
    expect(ClaudeSessionStatus.verdict(session({ agentSessionId: undefined }), undefined, false, 13 * minute)).toBeUndefined();
  });
});

describe("ClaudeSessionStatus.parseRecord", () => {
  it("reads the fields it needs from a record Claude Code 2.1.310 wrote", () => {
    const text = JSON.stringify({ pid: 8515, sessionId: "70c7482b", cwd: "/p/synqed", kind: "bg", status: "shell", updatedAt: 1792929058440, statusUpdatedAt: 1792929058440, version: "2.1.309" });
    expect(ClaudeSessionStatus.parseRecord(text)).toEqual({ pid: 8515, sessionId: "70c7482b", status: "shell", statusUpdatedAt: 1792929058440 });
  });

  it("refuses a record without a process or a session id", () => {
    expect(ClaudeSessionStatus.parseRecord("not json")).toBeUndefined();
    expect(ClaudeSessionStatus.parseRecord(JSON.stringify({ sessionId: "x" }))).toBeUndefined();
    expect(ClaudeSessionStatus.parseRecord(JSON.stringify({ pid: 3 }))).toBeUndefined();
  });
});
