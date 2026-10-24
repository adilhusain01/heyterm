import { describe, expect, it } from "vitest";
import { SpokenLineDeduplicator } from "./mac-voice.ts";

describe("SpokenLineDeduplicator", () => {
  it("lets a line through once when two open pages ask for it together", () => {
    const deduplicator = new SpokenLineDeduplicator(3_000);
    expect(deduplicator.shouldSpeak("Portfolio is done.", 0)).toBe(true);
    expect(deduplicator.shouldSpeak("Portfolio is done.", 400)).toBe(false);
  });

  it("says the same line again later, when it is new news", () => {
    const deduplicator = new SpokenLineDeduplicator(3_000);
    deduplicator.shouldSpeak("Portfolio is done.", 0);
    expect(deduplicator.shouldSpeak("Portfolio is done.", 10_000)).toBe(true);
  });
});
