import { describe, expect, it } from "vitest";
import { ToolOutput } from "./tool-output.ts";

describe("ToolOutput.fromToolResult", () => {
  it("reads a tool result given as text or as text blocks", () => {
    expect(ToolOutput.fromToolResult("Sunday 1:45 PM")).toBe("Sunday 1:45 PM");
    expect(ToolOutput.fromToolResult([{ type: "text", text: "line one" }, { type: "text", text: "line two" }])).toBe("line one\nline two");
  });

  it("names what is not text instead of dropping it", () => {
    expect(ToolOutput.fromToolResult([{ type: "image", source: {} }])).toBe("[an image]");
    expect(ToolOutput.fromToolResult(undefined)).toBe("");
  });
});

describe("ToolOutput.capped", () => {
  // The conversation is saved with HeyTerm's memory, so one long log must not swell it.
  it("keeps the end of a long output, where errors and results usually are, and says what was cut", () => {
    const output = "a".repeat(10_000) + "THE END";
    const kept = ToolOutput.capped(output, 100);
    expect(kept.endsWith("THE END")).toBe(true);
    expect(kept.startsWith("[9,907 earlier characters not kept]\n")).toBe(true);
  });

  it("leaves a short output whole", () => {
    expect(ToolOutput.capped("ok", 100)).toBe("ok");
  });
});
