import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Assistant } from "./assistant.ts";
import type { Conductor } from "./conductor.ts";
import type { SessionView } from "../../shared/types.ts";

function session(name: string, overrides: Partial<SessionView>): SessionView {
  return { name, projectPath: `/p/${name}`, projectName: name, agent: "claude", state: "working", stateSince: 100, createdAt: 0, lastSeenAt: 0, activitySinceSeen: [], waitedMillisecondsToday: 0, ...overrides };
}

function makeAssistant(sessions: SessionView[], conductor = Object.assign(new EventEmitter(), { ask: vi.fn(async () => "Noted."), close: vi.fn() }) as unknown as Conductor): Assistant {
  return new Assistant(conductor, async () => ({ sessions, projectNames: [], recentlyClosedNames: [] }), () => "speak");
}

afterEach(() => vi.useRealTimers());

describe("Assistant.noteSessions", () => {
  it("puts a request into the conversation as soon as it arrives, as an answerable request line", () => {
    vi.useFakeTimers();
    const ultron = session("ultron", { state: "needs_trust", stateSince: 500 });
    const assistant = makeAssistant([ultron]);
    // The first look at startup is what was already there; arrivals come after it.
    assistant.noteSessions([]);
    assistant.noteSessions([ultron]);
    expect(assistant.conversation()).toEqual([expect.objectContaining({ kind: "request", text: "ultron needs you to trust its folder", request: { session: "ultron", kind: "trust", since: 500 } })]);
  });

  it("tells finished work as an event, since nothing waits on the user", () => {
    vi.useFakeTimers();
    const docs = session("docs", { state: "done", stateSince: 500, lastMessage: "Updated the README." });
    const assistant = makeAssistant([docs]);
    assistant.noteSessions([]);
    assistant.noteSessions([docs]);
    expect(assistant.conversation()).toEqual([expect.objectContaining({ kind: "event", text: "docs finished: Updated the README." })]);
  });
});

describe("Assistant.recordReply", () => {
  it("shows a clicked answer as the user's own line", () => {
    const assistant = makeAssistant([]);
    assistant.recordReply("Trust ultron");
    expect(assistant.conversation()).toEqual([expect.objectContaining({ kind: "user", text: "Trust ultron" })]);
  });
});

describe("Assistant, a command's output", () => {
  // Adil, 25 October 2026: every command the assistant runs should open to show its full output.
  it("attaches each tool's result to its own line, and marks one that failed", () => {
    const conductor = Object.assign(new EventEmitter(), { ask: vi.fn(async () => "Noted."), close: vi.fn() }) as unknown as Conductor;
    const assistant = makeAssistant([], conductor);
    conductor.emit("activity", "tool", 'run TZ=Europe/Berlin date "+%-I:%M %p"', "tool-1");
    conductor.emit("activity", "tool", "run false", "tool-2");
    conductor.emit("toolResult", "tool-1", "1:45 PM", false);
    conductor.emit("toolResult", "tool-2", "Exit code 1", true);
    expect(assistant.conversation()).toEqual([
      expect.objectContaining({ kind: "tool", text: 'run TZ=Europe/Berlin date "+%-I:%M %p"', output: { text: "1:45 PM", failed: false } }),
      expect.objectContaining({ kind: "tool", text: "run false", output: { text: "Exit code 1", failed: true } }),
    ]);
  });
});
