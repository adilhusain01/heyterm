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

  it("says how many files finished work changed, written and spoken", () => {
    const [item] = AttentionQueue.build([makeSession("api", { state: "done", stateSince: 5, lastSeenAt: 0, lastMessage: "Fixed the totals. Tests pass.", filesChangedInLastTask: ["src/totals.ts", "src/totals.test.ts"] })]);
    expect(item?.headline).toBe("api finished: Fixed the totals. Changed 2 files.");
    expect(item?.spoken).toBe("api is done. It changed 2 files.");
    const [none] = AttentionQueue.build([makeSession("docs", { state: "done", stateSince: 5, lastSeenAt: 0, lastMessage: "Nothing to do." })]);
    expect(none?.spoken).toBe("docs is done.");
  });

  it("says when a working session has gone quiet, last in line", () => {
    const [quiet] = AttentionQueue.build([makeSession("api", { state: "working", quiet: { kind: "quiet", since: 0 } })]);
    expect(quiet).toMatchObject({ kind: "quiet", headline: "api has gone quiet: nothing from it for 5 minutes", spoken: "api has gone quiet for 5 minutes. It may be stuck." });
    const [command] = AttentionQueue.build([makeSession("web", { state: "working", quiet: { kind: "long_command", since: 0 }, runningCommand: { text: "pnpm build", since: 0 } })]);
    expect(command).toMatchObject({ kind: "quiet", headline: "web has been running one command for 10 minutes: pnpm build", spoken: "web has been running one command for 10 minutes." });
    const order = AttentionQueue.build([makeSession("api", { state: "working", quiet: { kind: "quiet", since: 0 } }), makeSession("tests", { state: "done", lastMessage: "All good." })]).map((item) => item.kind);
    expect(order).toEqual(["finished", "quiet"]);
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

describe("spoken lines", () => {
  function spokenFor(session: SessionView): string | undefined {
    return AttentionQueue.build([session])[0]?.spoken;
  }

  it("says what a permission needs from the user, never the command itself", () => {
    expect(spokenFor(makeSession("bookboy", { state: "needs_permission", pending: permission }))).toBe("bookboy wants to run a command. Say approve or deny.");
  });

  it("names the risk of a high-risk command, and approve answers it like any other (HeyTerm adds no gate of its own)", () => {
    const risky: PendingRequest = { ...permission, summary: "git push --force origin main", risk: "high", riskReasons: ["force pushes"] };
    expect(spokenFor(makeSession("bookboy", { state: "needs_permission", pending: risky }))).toBe("bookboy wants to run a command that force pushes. Say approve or deny.");
  });

  it("does not call a high-risk file edit a command", () => {
    const edit: PendingRequest = { ...permission, toolName: "Write", summary: "edit /tmp/x", risk: "high", riskReasons: ["edits a file outside the project"] };
    expect(spokenFor(makeSession("demo", { state: "needs_permission", pending: edit }))).toBe("demo wants permission for something that edits a file outside the project. Say approve or deny.");
  });

  it("says a file edit is a file edit", () => {
    const edit: PendingRequest = { ...permission, toolName: "Edit", summary: "edit src/app.ts" };
    expect(spokenFor(makeSession("bookboy", { state: "needs_permission", pending: edit }))).toBe("bookboy wants to edit a file. Say approve or deny.");
  });

  it("reads a question with its choices, since those are what the user answers with", () => {
    expect(spokenFor(makeSession("synqed", { state: "asked", pending: question }))).toBe("synqed asks: Which database? Neon or Supabase.");
  });

  it("says finished work is done without reading the agent's report", () => {
    expect(spokenFor(makeSession("peeker", { state: "done", stateSince: 100, lastSeenAt: 0, lastMessage: "Fixed the phone menu. Also ran the tests." }))).toBe("peeker is done.");
  });

  it("says when it is the agent's hooks, not a folder, that need trusting", () => {
    expect(spokenFor(makeSession("demo", { state: "needs_trust", trustSubject: "hooks" }))).toBe("demo asks you to trust HeyTerm's hooks. Say trust it.");
  });

  it("asks for the trust and names a failure", () => {
    expect(spokenFor(makeSession("ultron", { state: "needs_trust" }))).toBe("ultron needs you to trust its folder. Say trust it.");
    expect(spokenFor(makeSession("ultron", { state: "failed" }))).toBe("ultron stopped on an error.");
  });
});

describe("AnnouncementText.forItems", () => {
  const permissionItem: AttentionItem = { sessionName: "bookboy", kind: "permission", since: 0, headline: "bookboy wants to run pnpm db:migrate", spoken: "bookboy wants to run a command. Say approve or deny." };
  const finishedItem: AttentionItem = { sessionName: "peeker", kind: "finished", since: 0, headline: "peeker finished: Fixed the menu.", spoken: "peeker is done." };

  it("speaks one item as its spoken line", () => {
    expect(AnnouncementText.forItems([permissionItem], "speak")).toBe("bookboy wants to run a command. Say approve or deny.");
  });

  it("speaks several items as one line that starts with the count", () => {
    expect(AnnouncementText.forItems([permissionItem, finishedItem], "speak")).toBe("Two sessions need you. bookboy wants to run a command. Say approve or deny. peeker is done.");
  });

  it("speaks only permissions and questions in quiet mode", () => {
    expect(AnnouncementText.forItems([finishedItem], "quiet")).toBeUndefined();
    expect(AnnouncementText.forItems([permissionItem, finishedItem], "quiet")).toBe("bookboy wants to run a command. Say approve or deny.");
  });

  it("speaks nothing when muted", () => {
    expect(AnnouncementText.forItems([permissionItem], "mute")).toBeUndefined();
  });
});
