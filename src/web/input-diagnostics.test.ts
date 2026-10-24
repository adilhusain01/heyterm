import { describe, expect, it } from "vitest";
import { InputDiagnostics } from "./input-diagnostics.ts";

describe("InputDiagnostics.describe", () => {
  it("records what kind of input arrived and how much, never the words", () => {
    const record = InputDiagnostics.describe({ type: "input", inputType: "insertText", data: "start a session in portfolio" }, { target: "bar", windowHasFocus: true, at: 5 });
    expect(record).toEqual({ at: 5, type: "input", inputType: "insertText", length: 28, target: "bar", windowHasFocus: true });
    expect(JSON.stringify(record)).not.toContain("portfolio");
  });

  it("names special keys and shortcuts but not the characters typed", () => {
    expect(InputDiagnostics.describe({ type: "keydown", key: "v", metaKey: true }, { target: "nothing", windowHasFocus: true, at: 1 })).toMatchObject({ key: "Meta+v" });
    expect(InputDiagnostics.describe({ type: "keydown", key: "Enter" }, { target: "bar", windowHasFocus: true, at: 1 })).toMatchObject({ key: "Enter" });
    expect(InputDiagnostics.describe({ type: "keydown", key: "s" }, { target: "bar", windowHasFocus: true, at: 1 }).key).toBeUndefined();
  });
});
