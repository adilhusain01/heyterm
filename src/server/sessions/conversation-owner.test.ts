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

describe("ConversationOwner.inItsConversationsFolder", () => {
  const worktree = { repoPath: "/p/Whisker", worktreePath: "/home/.heyterm/worktrees/Whisker-whisker-2", branch: "heyterm/whisker-2", baseCommit: "744fe46" };
  const conversationFile = "/home/.claude/projects/-p-Whisker/8fd9f8e2.jsonl";

  // Seen on 26 October 2026: whisker ran in a HeyTerm worktree, but its conversation came from the
  // main folder through /resume, so Claude Code kept it there and worked there.
  it("reopens a session in the folder its conversation runs in, out of a worktree it no longer uses", () => {
    const session = closed({ projectPath: worktree.worktreePath, worktree });
    const moved = ConversationOwner.inItsConversationsFolder(session, "/p/Whisker", conversationFile);
    expect(moved.projectPath).toBe("/p/Whisker");
    expect(moved.worktree).toBeUndefined();
    expect(moved.transcriptPath).toBe(conversationFile);
  });

  it("keeps the worktree when the conversation runs in a folder inside it", () => {
    const session = closed({ projectPath: worktree.worktreePath, worktree });
    const moved = ConversationOwner.inItsConversationsFolder(session, `${worktree.worktreePath}/app`, conversationFile);
    expect(moved.projectPath).toBe(`${worktree.worktreePath}/app`);
    expect(moved.worktree).toEqual(worktree);
  });

  it("changes nothing but the file's path when the conversation runs where the session does", () => {
    const session = closed({ projectPath: "/p/whisker" });
    expect(ConversationOwner.inItsConversationsFolder(session, "/p/whisker", conversationFile)).toEqual({ ...session, transcriptPath: conversationFile });
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
