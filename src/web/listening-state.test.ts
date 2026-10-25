import { describe, expect, it } from "vitest";
import { ListeningState } from "./listening-state.ts";

describe("ListeningState.of", () => {
  it("listens when the window is in front and the bar has the cursor", () => {
    expect(ListeningState.of({ windowHasFocus: true, focusedElement: "bar" })).toBe("listening");
  });

  it("says the window is in the background when another app is in front, wherever the cursor was", () => {
    expect(ListeningState.of({ windowHasFocus: false, focusedElement: "bar" })).toBe("window_in_background");
    expect(ListeningState.of({ windowHasFocus: false, focusedElement: "nothing" })).toBe("window_in_background");
  });

  it("says typing goes to a terminal when one has the cursor", () => {
    expect(ListeningState.of({ windowHasFocus: true, focusedElement: "terminal" })).toBe("typing_in_terminal");
  });

  // Dictation pasted with no field focused goes into the bar (pasteBelongsToBar), so selecting text
  // in the conversation, which leaves no field focused, does not stop HeyTerm listening. Until
  // 26 October 2026 this said "not listening", and selecting text showed it.
  it("listens when no field has the cursor, since dictation pasted then goes to the bar", () => {
    expect(ListeningState.of({ windowHasFocus: true, focusedElement: "nothing" })).toBe("listening");
  });

  it("is not listening when another field has the cursor", () => {
    expect(ListeningState.of({ windowHasFocus: true, focusedElement: "other_field" })).toBe("not_listening");
  });
});

describe("ListeningState.pasteBelongsToBar", () => {
  it("takes dictation pasted onto the page when no field has the cursor", () => {
    expect(ListeningState.pasteBelongsToBar("nothing")).toBe(true);
  });

  it("takes a paste into the bar itself, because a browser extension can cancel the normal insert (seen in the input log of 25 October 2026)", () => {
    expect(ListeningState.pasteBelongsToBar("bar")).toBe(true);
  });

  it("leaves a paste alone in a terminal or another field", () => {
    expect(ListeningState.pasteBelongsToBar("terminal")).toBe(false);
    expect(ListeningState.pasteBelongsToBar("other_field")).toBe(false);
  });
});
