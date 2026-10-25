import { describe, expect, it } from "vitest";
import { ConductorRouting, ConductorSafety, NarrationRules, SpokenReply } from "./conductor-rules.ts";

describe("ConductorRouting.handledInstantly", () => {
  it("answers decisions and controls at once, since a yes should never wait on a model", () => {
    for (const action of [
      { type: "approve", session: "a", requestId: "r", confirmed: false },
      { type: "deny", session: "a", requestId: "r" },
      { type: "confirm" },
      { type: "cancel" },
      { type: "choose", index: 0 },
      { type: "mode", mode: "quiet" },
      { type: "send", session: "a", text: "run the tests", needsPreview: true },
      { type: "spawn", project: "portfolio" },
      { type: "close", session: "a", confirmed: false },
    ] as const) {
      expect(ConductorRouting.handledInstantly(action, { confirmationWaiting: true })).toBe(true);
    }
  });

  it("passes a confirm to the assistant when nothing in HeyTerm waits for one, since the assistant may have asked for it", () => {
    expect(ConductorRouting.handledInstantly({ type: "confirm" }, { confirmationWaiting: false })).toBe(false);
  });

  it("hands catching up and status questions to the assistant, which can explain in its own words", () => {
    expect(ConductorRouting.handledInstantly({ type: "catch_up" }, { confirmationWaiting: false })).toBe(false);
    expect(ConductorRouting.handledInstantly({ type: "status", session: "a" }, { confirmationWaiting: false })).toBe(false);
  });
});

describe("SpokenReply.from", () => {
  it("speaks a short reply as written", () => {
    expect(SpokenReply.from("Portfolio is done and the build passes.")).toEqual({ spoken: "Portfolio is done and the build passes.", shown: "Portfolio is done and the build passes." });
  });

  it("speaks only what comes before a line of three dashes, and shows all of it", () => {
    const reply = "Two tests fail in the header.\n---\n- header.test.ts: expected 3\n- nav.test.ts: timeout";
    expect(SpokenReply.from(reply)).toEqual({ spoken: "Two tests fail in the header.", shown: "Two tests fail in the header.\n\n- header.test.ts: expected 3\n- nav.test.ts: timeout" });
  });

  it("drops markdown marks and code from what is spoken", () => {
    expect(SpokenReply.from("Run **`pnpm test`** in _portfolio_ now.").spoken).toBe("Run pnpm test in portfolio now.");
    expect(SpokenReply.from("Here it is:\n```\nls -la\n```\nThat is all.").spoken).toBe("Here it is: That is all.");
  });
});

describe("SpokenReply.from, for long replies", () => {
  it("says only the first two sentences of a long reply and points to the screen", () => {
    const long = "Portfolio fixed the header. The tests pass now. " + "It also renamed a lot of files and cleaned up imports in many places across the project. ".repeat(4);
    expect(SpokenReply.from(long).spoken).toBe("Portfolio fixed the header. The tests pass now. The rest is on screen.");
  });
});

describe("NarrationRules.stillWaiting", () => {
  const item = (sessionName: string, since: number) => ({ sessionName, kind: "permission" as const, since, headline: "", spoken: "" });

  it("keeps what still needs the user", () => {
    expect(NarrationRules.stillWaiting([item("a", 1), item("b", 2)], [item("b", 2)])).toEqual([item("b", 2)]);
  });

  it("drops a request the user already answered, so it is not announced late", () => {
    expect(NarrationRules.stillWaiting([item("a", 1)], [])).toEqual([]);
  });
});

describe("ConductorSafety.touchesPrivateKeys", () => {
  it("refuses any tool aimed at the PrivateKeys folder", () => {
    expect(ConductorSafety.touchesPrivateKeys("Read", { file_path: "/Users/me/PrivateKeys/wallet.txt" })).toBe(true);
    expect(ConductorSafety.touchesPrivateKeys("Bash", { command: "cat ~/Documents/PrivateKeys/*" })).toBe(true);
    expect(ConductorSafety.touchesPrivateKeys("Grep", { pattern: "key", path: "/Users/me/privatekeys" })).toBe(true);
  });

  it("leaves everything else alone", () => {
    expect(ConductorSafety.touchesPrivateKeys("Read", { file_path: "/Users/me/project/src/keys.ts" })).toBe(false);
    expect(ConductorSafety.touchesPrivateKeys("Bash", { command: "git status" })).toBe(false);
  });
});
