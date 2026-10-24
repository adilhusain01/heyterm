import { describe, expect, it } from "vitest";
import { AttentionQueue, AnnouncementText } from "./attention.ts";
import type { AttentionItem, PendingRequest, SessionView } from "./types.ts";

function makeSession(name: string, overrides: Partial<SessionView> = {}): SessionView {
  return {
    name,
    projectPath: `/projects/${name}`,
    projectName: name,
    agent: "claude",
    state: "working",
    stateSince: 100,
    createdAt: 0,
    lastSeenAt: 0,
    activitySinceSeen: [],
    waitedMillisecondsToday: 0,
    ...overrides,
  };
}

const permission: PendingRequest = {
  kind: "permission",
  requestId: "p1",
  toolName: "Bash",
  toolInput: {},
  summary: "pnpm db:migrate",
  risk: "low",
  riskReasons: [],
  createdAt: 0,
};

const question: PendingRequest = {
  kind: "question",
  requestId: "q1",
  questions: [{ question: "Which database?", options: [{ label: "Neon" }, { label: "Supabase" }] }],
  toolInput: {},
  createdAt: 0,
};

describe("AttentionQueue.build", () => {
  it("puts permissions first, then questions, trust, failures and finished work", () => {
    const queue = AttentionQueue.build([
      makeSession("finished", { state: "done", lastMessage: "All good." }),
      makeSession("failing", { state: "failed" }),
      makeSession("trusting", { state: "needs_trust" }),
      makeSession("asking", { state: "asked", pending: question }),
      makeSession("permitting", { state: "needs_permission", pending: permission }),
    ]);
    expect(queue.map((item) => item.kind)).toEqual(["permission", "question", "trust", "failed", "finished"]);
  });

  it("puts the longest wait first within one kind", () => {
    const queue = AttentionQueue.build([
      makeSession("newer", { state: "done", stateSince: 500 }),
      makeSession("older", { state: "done", stateSince: 200 }),
    ]);
    expect(queue.map((item) => item.sessionName)).toEqual(["older", "newer"]);
  });

  it("leaves out finished work the user has already looked at", () => {
    const queue = AttentionQueue.build([makeSession("seen", { state: "done", stateSince: 100, lastSeenAt: 150 })]);
    expect(queue).toEqual([]);
  });

  it("keeps a question the user looked at but did not answer", () => {
    const queue = AttentionQueue.build([makeSession("asking", { state: "asked", pending: question, lastSeenAt: 150 })]);
    expect(queue).toHaveLength(1);
  });

  it("leaves out sessions that are working, idle, starting or stopped", () => {
    const states = ["working", "idle", "starting", "stopped"] as const;
    expect(AttentionQueue.build(states.map((state) => makeSession(state, { state })))).toEqual([]);
  });

  it("writes headlines a person can hear", () => {
    const [permissionItem, questionItem, textQuestionItem, finishedItem] = AttentionQueue.build([
      makeSession("bookboy", { state: "needs_permission", pending: permission }),
      makeSession("synqed", { state: "asked", pending: question }),
      makeSession("whisker", { state: "asked", lastMessage: "I fixed it.\n\nShould I also update the README?", stateSince: 101 }),
      makeSession("peeker", { state: "done", lastMessage: "Fixed the phone menu. Tests pass.\n\nDetails follow." }),
    ]);
    expect(permissionItem?.headline).toBe("bookboy wants to run pnpm db:migrate");
    expect(questionItem?.headline).toBe("synqed asks: Which database? Neon or Supabase");
    expect(textQuestionItem?.headline).toBe("whisker asks: Should I also update the README?");
    expect(finishedItem?.headline).toBe("peeker finished: Fixed the phone menu.");
  });

  it("asks for an answer in the terminal when a dialog was left open across a restart", () => {
    const [item] = AttentionQueue.build([makeSession("bookboy", { state: "asked", blockedByTerminalDialog: true })]);
    expect(item).toMatchObject({ kind: "question", headline: "bookboy is waiting on a dialog in its terminal" });
  });

  it("carries the request id for items that wait on a hook", () => {
    const [item] = AttentionQueue.build([makeSession("bookboy", { state: "needs_permission", pending: permission })]);
    expect(item?.requestId).toBe("p1");
  });
});

describe("AnnouncementText.forItems", () => {
  const permissionItem: AttentionItem = { sessionName: "bookboy", kind: "permission", since: 0, headline: "bookboy wants to run pnpm db:migrate" };
  const finishedItem: AttentionItem = { sessionName: "peeker", kind: "finished", since: 0, headline: "peeker finished: Fixed the menu." };

  it("speaks one item as its headline", () => {
    expect(AnnouncementText.forItems([permissionItem], "speak")).toBe("bookboy wants to run pnpm db:migrate");
  });

  it("speaks several items as one line that starts with the count", () => {
    expect(AnnouncementText.forItems([permissionItem, finishedItem], "speak")).toBe(
      "Two sessions need you. bookboy wants to run pnpm db:migrate. peeker finished: Fixed the menu.",
    );
  });

  it("speaks only permissions and questions in quiet mode", () => {
    expect(AnnouncementText.forItems([finishedItem], "quiet")).toBeUndefined();
    expect(AnnouncementText.forItems([permissionItem, finishedItem], "quiet")).toBe("bookboy wants to run pnpm db:migrate");
  });

  it("speaks nothing when muted", () => {
    expect(AnnouncementText.forItems([permissionItem], "mute")).toBeUndefined();
  });
});
