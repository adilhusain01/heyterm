import { describe, expect, it } from "vitest";
import { ConversationOwner } from "./conversation-owner.ts";
import type { SessionView } from "../../shared/types.ts";

function closed(overrides: Partial<SessionView>): SessionView {
  return { name: "whisker", origin: "external", projectPath: "/p/whisker", projectName: "whisker", agent: "claude", state: "stopped", stateSince: 0, createdAt: 0, lastSeenAt: 0, agentSessionId: "6f41676e", activitySinceSeen: [], waitedMillisecondsToday: 0, ...overrides };
}

describe("ConversationOwner.reopenedHere", () => {
  // Seen on 25 October 2026: a session from Adil's own terminal was brought back into HeyTerm but
  // kept its "own terminal" mark, so it got no pane and HeyTerm would not type into it.
  it("brings a closed session back as one of HeyTerm's own, whatever terminal it ran in before", () => {
    expect(ConversationOwner.reopenedHere(closed({}), 50)).toMatchObject({ origin: "heyterm", state: "starting", stateSince: 50, pending: undefined });
  });
});

describe("ConversationOwner.liveProcess", () => {
  const records = new Map([["6f41676e", { pid: 58033, sessionId: "6f41676e", status: "busy" }]]);

  // The same day the conversation was resumed in HeyTerm while it was still open in the terminal,
  // so two Claude processes wrote to one conversation.
  it("finds the process that still has a conversation open", () => {
    expect(ConversationOwner.liveProcess(closed({}), records, () => true)).toBe(58033);
  });

  it("finds none when that process has ended, or for another agent", () => {
    expect(ConversationOwner.liveProcess(closed({}), records, () => false)).toBeUndefined();
    expect(ConversationOwner.liveProcess(closed({ agent: "codex" }), records, () => true)).toBeUndefined();
    expect(ConversationOwner.liveProcess(closed({ agentSessionId: undefined }), records, () => true)).toBeUndefined();
  });
});
