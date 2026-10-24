import { describe, expect, it } from "vitest";
import { ConductorRouting, SpokenReply, ConductorSafety } from "./conductor-rules.ts";

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

  it("passes a confirm to the assistant when nothing in Callsign waits for one, since the assistant may have asked for it", () => {
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

describe("ConductorSafety.commandDecision", () => {
  it("runs ordinary commands without asking", () => {
    expect(ConductorSafety.commandDecision("git status && ls")).toEqual({ needsConfirm: false });
  });

  it("holds a high-risk command until the user says confirm, with the reason to say", () => {
    expect(ConductorSafety.commandDecision("git push origin main")).toEqual({ needsConfirm: true, reason: "pushes to a remote" });
  });
});
