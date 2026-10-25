import { describe, expect, it } from "vitest";
import { ThemeChoice } from "./theme-choice.ts";

describe("ThemeChoice.resolve", () => {
  it("starts on the light Gruvbox theme when nothing was chosen", () => {
    expect(ThemeChoice.resolve(undefined, true)).toBe("light");
  });

  it("keeps a chosen theme whatever the system says", () => {
    expect(ThemeChoice.resolve("dark", false)).toBe("dark");
    expect(ThemeChoice.resolve("light", true)).toBe("light");
  });

  it("follows the system when asked to", () => {
    expect(ThemeChoice.resolve("system", true)).toBe("dark");
    expect(ThemeChoice.resolve("system", false)).toBe("light");
  });

  it("treats anything unknown in storage as no choice", () => {
    expect(ThemeChoice.resolve("sepia" as never, true)).toBe("light");
  });
});
