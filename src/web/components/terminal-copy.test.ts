import { describe, expect, it } from "vitest";
import { TerminalCopy } from "./terminal-copy.ts";

const key = (overrides: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>) => ({ key: "c", ctrlKey: false, metaKey: false, shiftKey: false, ...overrides });

describe("TerminalCopy.copiesSelection", () => {
  it("copies with Cmd+C on a Mac", () => {
    expect(TerminalCopy.copiesSelection(key({ metaKey: true }), true, true)).toBe(true);
  });

  // Ctrl+C would otherwise send an interrupt and stop the agent mid-task.
  it("copies with Ctrl+C on Windows and Linux when text is selected", () => {
    expect(TerminalCopy.copiesSelection(key({ ctrlKey: true }), true, false)).toBe(true);
    expect(TerminalCopy.copiesSelection(key({ ctrlKey: true, shiftKey: true }), true, false)).toBe(true);
  });

  it("leaves Ctrl+C as an interrupt when nothing is selected", () => {
    expect(TerminalCopy.copiesSelection(key({ ctrlKey: true }), false, false)).toBe(false);
    expect(TerminalCopy.copiesSelection(key({ ctrlKey: true }), false, true)).toBe(false);
  });

  it("ignores other keys", () => {
    expect(TerminalCopy.copiesSelection(key({ key: "v", metaKey: true }), true, true)).toBe(false);
  });
});
