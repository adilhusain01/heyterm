import { describe, expect, it } from "vitest";
import { FocusReclaim } from "./focus-reclaim.ts";

const nothingGoingOn = { anotherFieldHasFocus: false, pointerIsDown: false, hasSelectedText: false };

describe("FocusReclaim.shouldReclaim", () => {
  it("brings focus back to the bar when nothing else wants it, so dictation lands there", () => {
    expect(FocusReclaim.shouldReclaim(nothingGoingOn)).toBe(true);
  });

  it("leaves another field or a terminal alone", () => {
    expect(FocusReclaim.shouldReclaim({ ...nothingGoingOn, anotherFieldHasFocus: true })).toBe(false);
  });

  // Asked for on 25 October 2026: select any text on the page and copy it with Cmd+C or Ctrl+C.
  it("waits while the user is selecting text, and while text stays selected for copying", () => {
    expect(FocusReclaim.shouldReclaim({ ...nothingGoingOn, pointerIsDown: true })).toBe(false);
    expect(FocusReclaim.shouldReclaim({ ...nothingGoingOn, hasSelectedText: true })).toBe(false);
  });
});
