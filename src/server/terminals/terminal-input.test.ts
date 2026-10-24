import { describe, expect, it } from "vitest";
import { TerminalInput } from "./terminal-input.ts";

describe("TerminalInput.keys", () => {
  it("turns key names into the bytes a terminal sends", () => {
    expect(TerminalInput.keys(["Down", "Down", "Enter"])).toBe("\x1b[B\x1b[B\r");
    expect(TerminalInput.keys(["Escape"])).toBe("\x1b");
    expect(TerminalInput.keys(["C-c"])).toBe("\x03");
  });

  it("refuses a key it does not know instead of typing its name", () => {
    expect(() => TerminalInput.keys(["Banana"])).toThrow();
  });
});

describe("TerminalInput.paste", () => {
  it("wraps text as a bracketed paste when the program asked for it, so a newline is not Enter", () => {
    expect(TerminalInput.paste("line one\nline two", { bracketedPaste: true })).toBe("\x1b[200~line one\rline two\x1b[201~");
  });

  it("strips a paste end marker hidden in the text, so it cannot break out of the paste", () => {
    expect(TerminalInput.paste("a\x1b[201~rm -rf /\n", { bracketedPaste: true })).toBe("\x1b[200~arm -rf /\r\x1b[201~");
  });

  it("joins lines with spaces when the program cannot take a paste, so nothing is submitted early", () => {
    expect(TerminalInput.paste("line one\nline two", { bracketedPaste: false })).toBe("line one line two");
  });

  it("drops other control characters from dictated text", () => {
    expect(TerminalInput.paste("hi\x03\x1bthere", { bracketedPaste: false })).toBe("hithere");
  });
});
