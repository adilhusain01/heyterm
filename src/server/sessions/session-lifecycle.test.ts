import { describe, expect, it } from "vitest";
import { SessionLifecycle } from "./session-lifecycle.ts";
import type { HookEvent, HookEventName, SessionView } from "../../shared/types.ts";

function makeSession(overrides: Partial<SessionView> = {}): SessionView {
  return {
    name: "bookboy",
    projectPath: "/projects/bookboy",
    projectName: "bookboy",
    agent: "claude",
    state: "starting",
    stateSince: 0,
    createdAt: 0,
    lastSeenAt: 0,
    activitySinceSeen: [],
    waitedMillisecondsToday: 0,
    ...overrides,
  };
}

function makeEvent(name: HookEventName, payload: Record<string, unknown>, receivedAt = 1_000): HookEvent {
  return { name, sessionName: "bookboy", payload, receivedAt };
}

describe("SessionLifecycle", () => {
  it("is idle once the agent has started", () => {
    const session = SessionLifecycle.apply(makeSession(), makeEvent("SessionStart", { session_id: "abc", source: "startup" }));
    expect(session.state).toBe("idle");
    expect(session.claudeSessionId).toBe("abc");
  });

  it("remembers where Claude saves the conversation, so bring back knows whether there is one", () => {
    const session = SessionLifecycle.apply(makeSession(), makeEvent("SessionStart", { session_id: "abc", transcript_path: "/t/abc.jsonl", source: "startup" }));
    expect(session.transcriptPath).toBe("/t/abc.jsonl");
  });

  it("is working once a prompt is submitted, and records the prompt", () => {
    const session = SessionLifecycle.apply(makeSession({ state: "idle" }), makeEvent("UserPromptSubmit", { prompt: "fix the menu" }));
    expect(session.state).toBe("working");
    expect(session.lastPrompt).toBe("fix the menu");
    expect(session.activitySinceSeen.at(-1)).toMatchObject({ kind: "prompt", text: "fix the menu" });
  });

  it("records the tools a working session uses, and the files it edits", () => {
    let session = makeSession({ state: "working" });
    session = SessionLifecycle.apply(session, makeEvent("PreToolUse", { tool_name: "Bash", tool_input: { command: "pnpm test" } }));
    session = SessionLifecycle.apply(session, makeEvent("PreToolUse", { tool_name: "Edit", tool_input: { file_path: "/projects/bookboy/src/menu.tsx" } }));
    expect(session.activitySinceSeen.map((entry) => [entry.kind, entry.text])).toEqual([
      ["tool", "pnpm test"],
      ["file", "src/menu.tsx"],
    ]);
  });

  it("holds a permission request with its risk", () => {
    const session = SessionLifecycle.apply(
      makeSession({ state: "working" }),
      makeEvent("PermissionRequest", { tool_name: "Bash", tool_input: { command: "git push --force" } }),
      { requestId: "p1" },
    );
    expect(session.state).toBe("needs_permission");
    expect(session.pending).toMatchObject({ kind: "permission", requestId: "p1", summary: "git push --force", risk: "high" });
  });

  it("holds a multiple-choice question as asked", () => {
    const questions = [{ question: "Tea or coffee?", header: "Drink", options: [{ label: "Tea" }, { label: "Coffee" }], multiSelect: false }];
    const session = SessionLifecycle.apply(
      makeSession({ state: "working" }),
      makeEvent("PermissionRequest", { tool_name: "AskUserQuestion", tool_input: { questions } }),
      { requestId: "q1" },
    );
    expect(session.state).toBe("asked");
    expect(session.pending).toMatchObject({ kind: "question", requestId: "q1", questions });
  });

  it("clears a request answered in the terminal when its tool runs", () => {
    const asked = SessionLifecycle.apply(
      makeSession({ state: "working" }),
      makeEvent("PermissionRequest", { tool_name: "AskUserQuestion", tool_input: { questions: [] } }),
      { requestId: "q1" },
    );
    const session = SessionLifecycle.apply(asked, makeEvent("PostToolUse", { tool_name: "AskUserQuestion" }, 5_000));
    expect(session.state).toBe("working");
    expect(session.pending).toBeUndefined();
  });

  it("is done when a turn ends without a question", () => {
    const session = SessionLifecycle.apply(makeSession({ state: "working" }), makeEvent("Stop", { last_assistant_message: "Fixed the menu. Tests pass." }));
    expect(session.state).toBe("done");
    expect(session.lastMessage).toBe("Fixed the menu. Tests pass.");
  });

  it("has asked when a turn ends with a question", () => {
    const message = "I updated the menu.\n\nShould I also update the README?";
    const session = SessionLifecycle.apply(makeSession({ state: "working" }), makeEvent("Stop", { last_assistant_message: message }));
    expect(session.state).toBe("asked");
  });

  it("has not asked when a question mark sits only in an early paragraph", () => {
    const message = "Why was it broken? The import was wrong.\n\nFixed it and the tests pass.";
    const session = SessionLifecycle.apply(makeSession({ state: "working" }), makeEvent("Stop", { last_assistant_message: message }));
    expect(session.state).toBe("done");
  });

  it("has failed when a turn ends on an error", () => {
    const session = SessionLifecycle.apply(makeSession({ state: "working" }), makeEvent("StopFailure", { error: "rate_limit" }));
    expect(session.state).toBe("failed");
  });

  it("is stopped when the session ends", () => {
    const session = SessionLifecycle.apply(makeSession({ state: "done" }), makeEvent("SessionEnd", { reason: "exit" }));
    expect(session.state).toBe("stopped");
  });

  it("adds the time spent waiting on the user once work starts again", () => {
    const waiting = makeSession({ state: "done", stateSince: 10_000, waitedMillisecondsToday: 500 });
    const session = SessionLifecycle.apply(waiting, makeEvent("UserPromptSubmit", { prompt: "next" }, 70_000));
    expect(session.waitedMillisecondsToday).toBe(60_500);
  });

  it("does not count working time as waiting", () => {
    const working = makeSession({ state: "working", stateSince: 10_000 });
    const session = SessionLifecycle.apply(working, makeEvent("Stop", { last_assistant_message: "done" }, 70_000));
    expect(session.waitedMillisecondsToday).toBe(0);
  });

  it("keeps state unchanged for notifications it already knows from other hooks", () => {
    const asked = makeSession({ state: "needs_permission", stateSince: 3 });
    const session = SessionLifecycle.apply(asked, makeEvent("Notification", { notification_type: "permission_prompt" }));
    expect(session.state).toBe("needs_permission");
    expect(session.stateSince).toBe(3);
  });

  it("needs trust when the screen shows the folder trust dialog", () => {
    const session = SessionLifecycle.applyTrustDialog(makeSession({ state: "starting" }), 2_000);
    expect(session.state).toBe("needs_trust");
    expect(session.stateSince).toBe(2_000);
  });

  it("forgets a dialog left open across a restart once the session reports anything", () => {
    const blocked = makeSession({ state: "asked", blockedByTerminalDialog: true });
    const session = SessionLifecycle.apply(blocked, makeEvent("PostToolUse", { tool_name: "AskUserQuestion" }));
    expect(session.blockedByTerminalDialog).toBeUndefined();
  });

  it("keeps only the most recent activity", () => {
    let session = makeSession({ state: "working" });
    for (let index = 0; index < 250; index += 1) {
      session = SessionLifecycle.apply(session, makeEvent("PreToolUse", { tool_name: "Bash", tool_input: { command: `step ${index}` } }));
    }
    expect(session.activitySinceSeen.length).toBe(SessionLifecycle.maximumActivityEntries);
    expect(session.activitySinceSeen.at(-1)?.text).toBe("step 249");
  });
});
