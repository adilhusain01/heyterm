import { describe, expect, it } from "vitest";
import { RequestThread } from "./request-thread.ts";
import type { ConversationEntry } from "./protocol.ts";
import type { SessionView } from "./types.ts";

function session(name: string, overrides: Partial<SessionView> = {}): SessionView {
  return {
    name,
    projectPath: `/p/${name}`,
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

const ultronNeedsTrust = session("ultron", { state: "needs_trust", stateSince: 500 });
const requestEntry: ConversationEntry = { id: 4, at: 510, kind: "request", text: "ultron needs you to trust its folder", request: { session: "ultron", kind: "trust", since: 500 } };

describe("RequestThread.isDecision", () => {
  it("counts permissions, questions, trust and failures as decisions, and finished work as news", () => {
    expect(["permission", "question", "trust", "failed"].every((kind) => RequestThread.isDecision(kind as never))).toBe(true);
    expect(RequestThread.isDecision("finished")).toBe(false);
  });
});

describe("RequestThread.isStillWaiting", () => {
  it("is waiting while the session still asks the same thing it asked then", () => {
    expect(RequestThread.isStillWaiting(requestEntry.request!, [ultronNeedsTrust])).toBe(true);
  });

  it("is settled once the session moved on", () => {
    expect(RequestThread.isStillWaiting(requestEntry.request!, [session("ultron", { state: "working", stateSince: 600 })])).toBe(false);
  });

  it("is settled when the session asks again later, since that is a new request with its own entry", () => {
    expect(RequestThread.isStillWaiting(requestEntry.request!, [session("ultron", { state: "needs_trust", stateSince: 900 })])).toBe(false);
  });

  it("is settled when the session is gone", () => {
    expect(RequestThread.isStillWaiting(requestEntry.request!, [])).toBe(false);
  });
});

describe("RequestThread.waitingWithoutEntry", () => {
  it("finds requests the conversation has no line for, such as ones older than the kept lines", () => {
    const portfolio = session("portfolio", { state: "failed", stateSince: 300 });
    const missing = RequestThread.waitingWithoutEntry([requestEntry], [ultronNeedsTrust, portfolio]);
    expect(missing.map((item) => item.sessionName)).toEqual(["portfolio"]);
  });

  it("leaves out finished work, which is news and not a request", () => {
    const done = session("docs", { state: "done", stateSince: 300, lastSeenAt: 0, lastMessage: "Done." });
    expect(RequestThread.waitingWithoutEntry([], [done])).toEqual([]);
  });
});

describe("RequestThread.replyWords", () => {
  const withQuestion = session("api", {
    state: "asked",
    pending: { kind: "question", requestId: "q1", questions: [{ question: "Which database?", header: "DB", options: [{ label: "Postgres", description: "" }, { label: "SQLite", description: "" }], multiSelect: false }], toolInput: {}, createdAt: 0 },
  });

  it("says what a clicked decision was, in the words the user would have said", () => {
    expect(RequestThread.replyWords({ type: "approve", session: "web", requestId: "r", confirmed: true })).toBe("Approve web");
    expect(RequestThread.replyWords({ type: "deny", session: "web", requestId: "r" })).toBe("Deny web");
    expect(RequestThread.replyWords({ type: "trust", session: "ultron" })).toBe("Trust ultron");
  });

  it("says the option chosen for a question", () => {
    expect(RequestThread.replyWords({ type: "answer", session: withQuestion.name, requestId: "q1", answers: { "Which database?": "Postgres" } })).toBe("api: Postgres");
  });

  it("adds nothing for clicks that are not answers to a request", () => {
    expect(RequestThread.replyWords({ type: "focus", session: "web" })).toBeUndefined();
    expect(RequestThread.replyWords({ type: "spawn", project: "web" })).toBeUndefined();
  });
});
