import { describe, expect, it } from "vitest";
import { UtteranceLimits } from "./utterance-limits.ts";

describe("UtteranceLimits.check", () => {
  it("passes what someone could say", () => {
    expect(UtteranceLimits.check("  start a session in portfolio  ")).toEqual({ ok: true, utterance: "start a session in portfolio" });
  });

  it("ignores nothing but spaces", () => {
    expect(UtteranceLimits.check("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses something far longer than speech, such as a pasted file, with a reason", () => {
    expect(UtteranceLimits.check("x".repeat(4_001))).toEqual({ ok: false, reason: "too_long" });
  });

  it("drops control characters a paste could carry", () => {
    expect(UtteranceLimits.check("fix\u0007 the \u001b[31mheader")).toEqual({ ok: true, utterance: "fix the [31mheader" });
  });

  it("drops the name said as a greeting, so commands after it still work", () => {
    expect(UtteranceLimits.check("Hey Term, start a session in web")).toEqual({ ok: true, utterance: "start a session in web" });
    expect(UtteranceLimits.check("hey terminal approve")).toEqual({ ok: true, utterance: "approve" });
    expect(UtteranceLimits.check("HeyTerm: what is everyone doing?")).toEqual({ ok: true, utterance: "what is everyone doing?" });
  });

  it("keeps words that only start the same way", () => {
    expect(UtteranceLimits.check("hey, terminate the web session")).toEqual({ ok: true, utterance: "hey, terminate the web session" });
  });
});
