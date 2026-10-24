import { describe, expect, it } from "vitest";
import { DictationDetector } from "./dictation-detector.ts";

describe("DictationDetector", () => {
  it("treats text that lands in one burst as dictation", () => {
    const detector = new DictationDetector();
    detector.recordChange("", "Tell bookboy to use Neon.", 1_000);
    expect(detector.inputSource).toBe("voice");
  });

  it("treats a short dictated answer as dictation", () => {
    for (const answer of ["Yes.", "Blue.", "No.", "Ok"]) {
      const detector = new DictationDetector();
      detector.recordChange("", answer, 1_000);
      expect(detector.inputSource, answer).toBe("voice");
    }
  });

  it("treats text typed a character at a time as typing", () => {
    const detector = new DictationDetector();
    let text = "";
    let at = 1_000;
    for (const character of "fix it") {
      const next = text + character;
      detector.recordChange(text, next, at);
      text = next;
      at += 120;
    }
    expect(detector.inputSource).toBe("keyboard");
  });

  it("submits dictation once it has been quiet for 600 milliseconds", () => {
    const detector = new DictationDetector();
    detector.recordChange("", "Approve that.", 1_000);
    expect(detector.shouldSubmit(1_500)).toBe(false);
    expect(detector.shouldSubmit(1_600)).toBe(true);
  });

  it("waits again when more dictation arrives", () => {
    const detector = new DictationDetector();
    detector.recordChange("", "Tell peeker", 1_000);
    detector.recordChange("Tell peeker", "Tell peeker to run the tests.", 1_400);
    expect(detector.shouldSubmit(1_700)).toBe(false);
    expect(detector.shouldSubmit(2_000)).toBe(true);
  });

  it("never submits typed text by itself", () => {
    const detector = new DictationDetector();
    detector.recordChange("", "f", 1_000);
    expect(detector.shouldSubmit(10_000)).toBe(false);
  });

  it("stops submitting when the user starts editing dictated text by hand", () => {
    const detector = new DictationDetector();
    detector.recordChange("", "Tell peeker to run the tests.", 1_000);
    detector.recordChange("Tell peeker to run the tests.", "Tell peeker to run the tests", 1_200);
    expect(detector.shouldSubmit(5_000)).toBe(false);
  });

  it("forgets everything after a reset", () => {
    const detector = new DictationDetector();
    detector.recordChange("", "Approve that.", 1_000);
    detector.reset();
    expect(detector.shouldSubmit(5_000)).toBe(false);
    expect(detector.inputSource).toBeUndefined();
  });
});
