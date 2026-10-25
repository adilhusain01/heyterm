import { describe, expect, it } from "vitest";
import { FastPathRouter } from "./fast-path-router.ts";
import type { AttentionItem, PendingRequest, RoutingContext, SessionView } from "../../shared/types.ts";

function makeSession(name: string, overrides: Partial<SessionView> = {}): SessionView {
  return {
    name,
    projectPath: `/projects/${name}`,
    projectName: name,
    agent: "claude",
    state: "working",
    stateSince: 0,
    createdAt: 0,
    lastSeenAt: 0,
    activitySinceSeen: [],
    waitedMillisecondsToday: 0,
    ...overrides,
  };
}

const neonQuestion: PendingRequest = {
  kind: "question",
  requestId: "q1",
  questions: [{ question: "Which database?", options: [{ label: "Neon" }, { label: "Supabase" }] }],
  toolInput: {},
  createdAt: 0,
};

const migratePermission: PendingRequest = {
  kind: "permission",
  requestId: "p1",
  toolName: "Bash",
  toolInput: { command: "pnpm db:migrate" },
  summary: "pnpm db:migrate",
  risk: "low",
  riskReasons: [],
  createdAt: 0,
};

const deletePermission: PendingRequest = { ...migratePermission, requestId: "p2", risk: "high", summary: "rm -rf build" };

function makeContext(overrides: Partial<RoutingContext> = {}): RoutingContext {
  return {
    sessions: [makeSession("synqed"), makeSession("peeker"), makeSession("bookboy")],
    projectNames: ["synqed", "peeker", "bookboy", "portfolio"],
    hasPendingPreview: false,
    ...overrides,
  };
}

function contextWithHead(session: SessionView, head: AttentionItem): RoutingContext {
  const others = makeContext().sessions.filter((existing) => existing.name !== session.name);
  return makeContext({ sessions: [...others, session], attentionHead: head });
}

const router = new FastPathRouter();

describe("approvals", () => {
  const session = makeSession("bookboy", { state: "needs_permission", pending: migratePermission });
  const head: AttentionItem = { sessionName: "bookboy", kind: "permission", since: 0, headline: "", spoken: "", requestId: "p1" };

  it("approves the permission at the top of the queue on a yes", () => {
    for (const utterance of ["Yes.", "approve", "Yeah, go ahead.", "allow it"]) {
      expect(router.route(utterance, contextWithHead(session, head))).toEqual({
        type: "approve",
        session: "bookboy",
        requestId: "p1",
        confirmed: false,
      });
    }
  });

  it("marks a spoken confirm as confirmed", () => {
    expect(router.route("Confirm.", contextWithHead(session, head))).toMatchObject({ type: "approve", confirmed: true });
  });

  it("denies with the rest of the sentence as the reason", () => {
    expect(router.route("No, use pnpm build instead.", contextWithHead(session, head))).toEqual({
      type: "deny",
      session: "bookboy",
      requestId: "p1",
      reason: "use pnpm build instead",
    });
  });

  it("approves a named session's permission even when it is not at the top", () => {
    const context = makeContext({
      sessions: [makeSession("synqed"), makeSession("peeker", { state: "needs_permission", pending: deletePermission })],
    });
    expect(router.route("approve peeker", context)).toMatchObject({ type: "approve", session: "peeker", requestId: "p2" });
  });
});

describe("answers to a question", () => {
  const session = makeSession("bookboy", { state: "asked", pending: neonQuestion });
  const head: AttentionItem = { sessionName: "bookboy", kind: "question", since: 0, headline: "", spoken: "", requestId: "q1" };

  it("answers with the option the user named", () => {
    expect(router.route("Neon.", contextWithHead(session, head))).toEqual({
      type: "answer",
      session: "bookboy",
      requestId: "q1",
      answers: { "Which database?": "Neon" },
    });
  });

  it("answers with an option picked by its position", () => {
    expect(router.route("the second one", contextWithHead(session, head))).toMatchObject({
      type: "answer",
      answers: { "Which database?": "Supabase" },
    });
  });

  it("answers in the user's own words when no option fits", () => {
    expect(router.route("Use SQLite for now.", contextWithHead(session, head))).toMatchObject({
      type: "answer",
      answers: { "Which database?": "Use SQLite for now." },
    });
  });
});

describe("talking to a session", () => {
  it("sends to the session named at the start", () => {
    expect(router.route("Peeker, run the tests again.", makeContext())).toEqual({
      type: "send",
      session: "peeker",
      text: "run the tests again.",
      needsPreview: true,
    });
  });

  it("sends what follows tell X to", () => {
    expect(router.route("tell book boy to use the brand colors", makeContext())).toMatchObject({
      type: "send",
      session: "bookboy",
      text: "use the brand colors",
    });
  });

  it("sends plain words to a session that asked something in text, without a preview", () => {
    const session = makeSession("synqed", { state: "asked", lastMessage: "Should I also update the README?" });
    const head: AttentionItem = { sessionName: "synqed", kind: "question", since: 0, headline: "", spoken: "" };
    expect(router.route("Yes, update it too.", contextWithHead(session, head))).toEqual({
      type: "send",
      session: "synqed",
      text: "Yes, update it too.",
      needsPreview: false,
    });
  });

  it("sends plain words to the focused session with a preview", () => {
    expect(router.route("now add a dark mode", makeContext({ focusedSession: "peeker" }))).toEqual({
      type: "send",
      session: "peeker",
      text: "now add a dark mode",
      needsPreview: true,
    });
  });

  it("never types into a session showing a dialog left open across a restart", () => {
    const session = makeSession("synqed", { state: "asked", blockedByTerminalDialog: true });
    const head: AttentionItem = { sessionName: "synqed", kind: "question", since: 0, headline: "", spoken: "" };
    expect(router.route("Blue.", contextWithHead(session, head))).toBeUndefined();
  });

  it("leaves a sentence that names a session in the middle to the model", () => {
    expect(router.route("make it match what synqed did yesterday", makeContext({ focusedSession: "peeker" }))).toBeUndefined();
  });

  it("leaves plain words with no target to the model", () => {
    expect(router.route("now add a dark mode", makeContext())).toBeUndefined();
  });
});

describe("while HeyTerm or the assistant waits for a yes", () => {
  const waiting = () => makeContext({ hasPendingConfirmation: true });

  it("takes yes, approve, go ahead and confirm as the yes", () => {
    for (const phrase of ["Yes.", "approve", "go ahead", "Confirm.", "do it"]) expect(router.route(phrase, waiting())).toEqual({ type: "confirm" });
  });

  it("takes no, deny and cancel as the no", () => {
    for (const phrase of ["No.", "deny", "cancel", "don't"]) expect(router.route(phrase, waiting())).toEqual({ type: "cancel" });
  });
});

describe("other agents and closed sessions", () => {
  it("starts a Codex or Gemini session when the user names the agent", () => {
    expect(router.route("start a codex session in portfolio", makeContext())).toEqual({ type: "spawn", project: "portfolio", agent: "codex" });
    expect(router.route("open gemini in peeker and fix the menu", makeContext())).toEqual({ type: "spawn", project: "peeker", agent: "gemini", task: "fix the menu" });
  });

  it("starts a Grok Build or Cursor session when the user names the agent", () => {
    expect(router.route("start a grok session in portfolio", makeContext())).toEqual({ type: "spawn", project: "portfolio", agent: "grok" });
    expect(router.route("open grok build in peeker and fix the menu", makeContext())).toEqual({ type: "spawn", project: "peeker", agent: "grok", task: "fix the menu" });
    expect(router.route("start a cursor session in portfolio", makeContext())).toEqual({ type: "spawn", project: "portfolio", agent: "cursor" });
  });

  it("starts Claude Code when no agent is named, as before", () => {
    expect(router.route("start a session in portfolio", makeContext())).toEqual({ type: "spawn", project: "portfolio" });
  });

  it("brings back a recently closed session at once, without asking the assistant", () => {
    expect(router.route("bring back ultron", makeContext({ recentlyClosedNames: ["ultron"] }))).toEqual({ type: "resume", session: "ultron" });
  });
});

describe("with the assistant in the middle", () => {
  const routerBesideAssistant = new FastPathRouter({ sendUnaddressedWordsToFocusedSession: false });

  it("leaves words that name no session to the assistant instead of typing them into the focused session", () => {
    expect(routerBesideAssistant.route("now add a dark mode", makeContext({ focusedSession: "peeker" }))).toBeUndefined();
  });

  it("still sends words that name a session straight to it", () => {
    expect(routerBesideAssistant.route("peeker, run the tests", makeContext({ focusedSession: "peeker" }))).toMatchObject({ type: "send", session: "peeker", text: "run the tests" });
  });
});

describe("session commands", () => {
  it("focuses a session", () => {
    expect(router.route("go to synced", makeContext())).toEqual({ type: "focus", session: "synqed" });
    expect(router.route("Show me Peeker.", makeContext())).toEqual({ type: "focus", session: "peeker" });
  });

  it("asks a session's status", () => {
    expect(router.route("What's bookboy doing?", makeContext())).toEqual({ type: "status", session: "bookboy" });
  });

  it("catches up", () => {
    for (const utterance of ["Catch me up.", "what did I miss", "What's going on?"]) {
      expect(router.route(utterance, makeContext())).toEqual({ type: "catch_up" });
    }
  });

  it("closes a session, unconfirmed", () => {
    expect(router.route("close peeker", makeContext())).toEqual({ type: "close", session: "peeker", confirmed: false });
  });

  it("interrupts a session", () => {
    expect(router.route("Stop synqed.", makeContext())).toEqual({ type: "interrupt", session: "synqed" });
  });

  it("starts a session in a project with a task", () => {
    expect(router.route("Start a session in portfolio and fix the phone menu.", makeContext())).toEqual({
      type: "spawn",
      project: "portfolio",
      task: "fix the phone menu.",
    });
  });

  it("starts a session in a project without a task", () => {
    expect(router.route("open a new agent on portfolio", makeContext())).toEqual({ type: "spawn", project: "portfolio" });
  });

  it("resumes a closed session", () => {
    expect(router.route("bring back peeker", makeContext())).toEqual({ type: "resume", session: "peeker" });
  });

  it("trusts a folder for the session waiting on it", () => {
    const session = makeSession("bookboy", { state: "needs_trust" });
    const head: AttentionItem = { sessionName: "bookboy", kind: "trust", since: 0, headline: "", spoken: "" };
    expect(router.route("Trust it.", contextWithHead(session, head))).toEqual({ type: "trust", session: "bookboy" });
    expect(router.route("yes", contextWithHead(session, head))).toEqual({ type: "trust", session: "bookboy" });
  });
});

describe("the preview and modes", () => {
  it("cancels a pending send", () => {
    for (const utterance of ["Cancel.", "wait", "No, wait.", "scratch that"]) {
      expect(router.route(utterance, makeContext({ hasPendingPreview: true }))).toEqual({ type: "cancel" });
    }
  });

  it("sends a pending preview at once", () => {
    expect(router.route("Send it.", makeContext({ hasPendingPreview: true }))).toEqual({ type: "send_now" });
  });

  it("switches announcement modes", () => {
    expect(router.route("Be quiet.", makeContext())).toEqual({ type: "mode", mode: "quiet" });
    expect(router.route("mute", makeContext())).toEqual({ type: "mode", mode: "mute" });
    expect(router.route("Talk to me.", makeContext())).toEqual({ type: "mode", mode: "speak" });
  });

  it("picks a clarify option by position", () => {
    expect(router.route("The first one.", makeContext({ pendingClarifyOptions: ["synqed", "peeker"] }))).toEqual({
      type: "choose",
      index: 0,
    });
  });
});
