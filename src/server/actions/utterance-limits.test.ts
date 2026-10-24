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
});
