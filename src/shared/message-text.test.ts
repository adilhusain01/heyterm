import { describe, expect, it } from "vitest";
import { firstSentence, lastQuestionSentence } from "./message-text.ts";

describe("firstSentence", () => {
  it("ends a sentence that leads into a list or code with a full stop instead of a colon", () => {
    expect(firstSentence("It failed again with the same error, so nothing was pushed:\n\nfatal: no origin")).toBe(
      "It failed again with the same error, so nothing was pushed.",
    );
  });

  it("leaves out markdown marks", () => {
    expect(firstSentence("**Fixed** the `menu` bug. Tests pass.")).toBe("Fixed the menu bug.");
  });
});

describe("lastQuestionSentence", () => {
  it("finds the question in the last paragraph", () => {
    expect(lastQuestionSentence("Done.\n\nI updated it. Should I push?")).toBe("Should I push?");
  });
});
