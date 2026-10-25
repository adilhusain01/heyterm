import { describe, expect, it } from "vitest";
import { SessionFacts } from "./session-facts.ts";

const now = new Date(2026, 9, 25, 17, 30).getTime();

describe("SessionFacts.rows", () => {
  it("names the agent, where it runs, its folder, when it started and its id", () => {
    const rows = SessionFacts.rows(
      { agent: "grok", origin: "heyterm", projectPath: "/Users/adil/Projects/api", agentSessionId: "8f1c2d", createdAt: new Date(2026, 9, 25, 9, 5).getTime() },
      now,
    );
    expect(rows).toEqual([
      { label: "Agent", value: "Grok Build" },
      { label: "Runs in", value: "HeyTerm" },
      { label: "Folder", value: "/Users/adil/Projects/api" },
      { label: "Started", value: "today at 09:05" },
      { label: "Session id", value: "8f1c2d", isCode: true },
    ]);
  });

  it("says when a closed session started and closed, on another day by its date", () => {
    const rows = SessionFacts.rows(
      { agent: "claude", origin: "external", projectPath: "/p/mine", createdAt: new Date(2026, 9, 24, 21, 14).getTime(), closedAt: new Date(2026, 9, 25, 2, 47).getTime() },
      now,
    );
    expect(rows).toEqual([
      { label: "Agent", value: "Claude Code" },
      { label: "Runs in", value: "Your own terminal" },
      { label: "Folder", value: "/p/mine" },
      { label: "Started", value: "24 Oct at 21:14" },
      { label: "Closed", value: "today at 02:47" },
    ]);
  });

  it("leaves out what it does not know", () => {
    expect(SessionFacts.rows({}, now)).toEqual([]);
  });

  it("names the branch of a session that works in a worktree of its own", () => {
    const rows = SessionFacts.rows({ agent: "claude", projectPath: "/data/worktrees/api-api-2", worktree: { repoPath: "/p/api", worktreePath: "/data/worktrees/api-api-2", branch: "heyterm/api-2", baseCommit: "abc" } }, now);
    expect(rows).toContainEqual({ label: "Branch", value: "heyterm/api-2, in a worktree of /p/api", isCode: true });
  });

  it("says a terminal runs no agent", () => {
    expect(SessionFacts.rows({ agent: "shell" }, now)).toEqual([{ label: "Agent", value: "None, a plain terminal" }]);
  });
});
