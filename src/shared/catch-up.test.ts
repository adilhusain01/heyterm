import { describe, expect, it } from "vitest";
import { CatchUpDigest } from "./catch-up.ts";
import type { ActivityEntry, SessionView } from "./types.ts";

function makeSession(name: string, activitySinceSeen: ActivityEntry[], overrides: Partial<SessionView> = {}): SessionView {
  return {
    name,
    projectPath: `/projects/${name}`,
    projectName: name,
    agent: "claude",
    state: "done",
    stateSince: 100,
    createdAt: 0,
    lastSeenAt: 0,
    activitySinceSeen,
    waitedMillisecondsToday: 0,
    ...overrides,
  };
}

describe("CatchUpDigest.forSession", () => {
  it("counts what happened and ends with the last message's first sentence", () => {
    const digest = CatchUpDigest.forSession(
      makeSession(
        "peeker",
        [
          { kind: "prompt", text: "fix the menu", at: 1 },
          { kind: "tool", text: "pnpm test", at: 2 },
          { kind: "file", text: "src/menu.tsx", at: 3 },
          { kind: "file", text: "src/menu.tsx", at: 4 },
          { kind: "file", text: "src/nav.tsx", at: 5 },
          { kind: "tool", text: "pnpm test", at: 6 },
        ],
        { lastMessage: "Fixed the phone menu. Both tests pass." },
      ),
    );
    expect(digest.spoken).toBe("peeker finished. 2 commands, 2 files changed. Fixed the phone menu.");
    expect(digest.changedFiles).toEqual(["src/menu.tsx", "src/nav.tsx"]);
  });

  it("says when nothing happened since the user last looked", () => {
    const digest = CatchUpDigest.forSession(makeSession("synqed", [], { state: "working" }));
    expect(digest.spoken).toBe("synqed is working. Nothing new since you looked.");
  });

  it("names what a waiting session needs", () => {
    const digest = CatchUpDigest.forSession(makeSession("bookboy", [{ kind: "tool", text: "ls", at: 1 }], { state: "needs_permission" }));
    expect(digest.spoken).toBe("bookboy needs a permission. 1 command.");
  });
});

describe("CatchUpDigest.forAll", () => {
  it("leaves out sessions with nothing new and puts waiting ones first", () => {
    const digests = CatchUpDigest.forAll([
      makeSession("quiet", [], { state: "working" }),
      makeSession("finished", [{ kind: "tool", text: "ls", at: 1 }], { state: "done" }),
      makeSession("asking", [{ kind: "tool", text: "ls", at: 1 }], { state: "asked", lastMessage: "Neon or Supabase?" }),
    ]);
    expect(digests.map((digest) => digest.sessionName)).toEqual(["asking", "finished"]);
  });
});
