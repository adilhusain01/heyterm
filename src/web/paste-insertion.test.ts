import { describe, expect, it } from "vitest";
import { PasteInsertion } from "./paste-insertion.ts";

describe("PasteInsertion.apply", () => {
  it("puts dictation into an empty bar", () => {
    expect(PasteInsertion.apply("", { start: 0, end: 0 }, "start a session in portfolio")).toEqual({ text: "start a session in portfolio", caret: 28 });
  });

  it("inserts at the cursor and replaces a selection, as a real paste would", () => {
    expect(PasteInsertion.apply("tell web to ", { start: 12, end: 12 }, "run the tests")).toEqual({ text: "tell web to run the tests", caret: 25 });
    expect(PasteInsertion.apply("tell web to fix it", { start: 12, end: 18 }, "run the tests")).toEqual({ text: "tell web to run the tests", caret: 25 });
  });

  it("adds a space between earlier words and new dictation when the cursor is at the end", () => {
    expect(PasteInsertion.apply("portfolio,", { start: 10, end: 10 }, "run the tests")).toEqual({ text: "portfolio, run the tests", caret: 24 });
  });

  it("keeps a dictation on one line, since the bar is one line", () => {
    expect(PasteInsertion.apply("", { start: 0, end: 0 }, "fix the header.\nThen run the tests.")).toEqual({ text: "fix the header. Then run the tests.", caret: 35 });
  });
});
