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
    // Since 27 October 2026 the folder and kind are needed too, to list sessions found only in records.
    expect(ClaudeSessionStatus.parseRecord(text)).toEqual({ pid: 8515, sessionId: "70c7482b", status: "shell", statusUpdatedAt: 1792929058440, cwd: "/p/synqed", kind: "bg" });
  });

  it("refuses a record without a process or a session id", () => {
    expect(ClaudeSessionStatus.parseRecord("not json")).toBeUndefined();
    expect(ClaudeSessionStatus.parseRecord(JSON.stringify({ sessionId: "x" }))).toBeUndefined();
    expect(ClaudeSessionStatus.parseRecord(JSON.stringify({ pid: 3 }))).toBeUndefined();
  });
});

describe("ClaudeSessionStatus.recordsCanBeTrusted", () => {
  it("trusts an empty folder, which means no Claude is running", () => {
    expect(ClaudeSessionStatus.recordsCanBeTrusted(0, 0)).toBe(true);
  });

  // The records are Claude Code's own and undocumented; if a new version writes them differently,
  // HeyTerm must not take that as every session having ended.
  it("does not trust a folder of records it cannot read", () => {
    expect(ClaudeSessionStatus.recordsCanBeTrusted(3, 0)).toBe(false);
  });

  it("trusts records it can read, even beside one it cannot", () => {
    expect(ClaudeSessionStatus.recordsCanBeTrusted(3, 2)).toBe(true);
  });
});

describe("ClaudeSessionStatus for sessions HeyTerm has not heard from", () => {
  // Seen on 26 October 2026: the VPS's HeyTerm showed none of its seven running Claude sessions,
  // because sessions are found only by their hooks, and these had sent none since it started.
  it("reads a record's name, folder and kind of session", () => {
    const text = JSON.stringify({ pid: 3834, sessionId: "7afa1836-aaaa", status: "idle", name: "kernel-cve-patch", nameSource: "user", cwd: "/root/Projects", kind: "bg", entrypoint: "cli" });
    expect(ClaudeSessionStatus.parseRecord(text)).toEqual({ pid: 3834, sessionId: "7afa1836-aaaa", status: "idle", name: "kernel-cve-patch", nameSource: "user", cwd: "/root/Projects", kind: "bg", entrypoint: "cli" });
  });

  it("finds the running command-line sessions it does not know yet", () => {
    const records = [
      record({ sessionId: "running", pid: 1, entrypoint: "cli", kind: "interactive", cwd: "/p/a" }),
      record({ sessionId: "background", pid: 2, entrypoint: "cli", kind: "bg", cwd: "/root/Projects" }),
      record({ sessionId: "gone", pid: 3, entrypoint: "cli", kind: "interactive", cwd: "/p/b" }),
      record({ sessionId: "known", pid: 4, entrypoint: "cli", kind: "interactive", cwd: "/p/c" }),
      // HeyTerm's own assistant runs on the Agent SDK; other programs' SDK sessions are theirs too.
      record({ sessionId: "assistant", pid: 5, entrypoint: "sdk-ts", kind: "interactive", cwd: "/Users/adil" }),
      record({ sessionId: "print", pid: 6, entrypoint: "cli", kind: "print", cwd: "/p/d" }),
      record({ sessionId: "nowhere", pid: 7, entrypoint: "cli", kind: "interactive" }),
    ];
    const found = ClaudeSessionStatus.undiscovered(records, new Set(["known"]), (pid) => pid !== 3);
    expect(found.map((found) => found.sessionId)).toEqual(["running", "background"]);
  });

  it("gives a found session the state its record shows", () => {
    expect(ClaudeSessionStatus.stateFromStatus("busy")).toBe("working");
    expect(ClaudeSessionStatus.stateFromStatus("idle")).toBe("idle");
    expect(ClaudeSessionStatus.stateFromStatus("shell")).toBe("idle");
    expect(ClaudeSessionStatus.stateFromStatus("waiting")).toBe("asked");
    expect(ClaudeSessionStatus.stateFromStatus(undefined)).toBe("idle");
  });

  // "87195547" is the conversation's id, which says nothing; the folder says more.
  it("names a found session by the name given to it, else by its folder", () => {
    expect(ClaudeSessionStatus.shownName(record({ sessionId: "87195547-1111", name: "kernel-cve-patch", nameSource: "user" }))).toBe("kernel-cve-patch");
    expect(ClaudeSessionStatus.shownName(record({ sessionId: "87195547-1111", name: "87195547" }))).toBeUndefined();
    expect(ClaudeSessionStatus.shownName(record({ sessionId: "aaaa", name: "adilhusain-90", nameSource: "derived" }))).toBeUndefined();
  });
});

describe("ClaudeSessionStatus.undiscovered and a session HeyTerm just started", () => {
  // A session HeyTerm starts writes its record before its first hook tells HeyTerm its id.
  it("waits ten seconds after a session started before listing it as one found in its record", () => {
    const now = 100_000;
    const fresh = record({ sessionId: "fresh", pid: 1, entrypoint: "cli", kind: "interactive", cwd: "/p/a", startedAt: now - 3_000 });
    const settled = record({ sessionId: "settled", pid: 2, entrypoint: "cli", kind: "interactive", cwd: "/p/b", startedAt: now - 30_000 });
    expect(ClaudeSessionStatus.undiscovered([fresh, settled], new Set(), () => true, now).map((found) => found.sessionId)).toEqual(["settled"]);
  });
});
