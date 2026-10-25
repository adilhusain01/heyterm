import { describe, expect, it } from "vitest";
import { SessionNames } from "./session-names.ts";

describe("SessionNames.fromTyped", () => {
  it("turns what the user typed or said into a sayable session name", () => {
    expect(SessionNames.fromTyped("Synqed Auth")).toBe("synqed-auth");
    expect(SessionNames.fromTyped("  api  ")).toBe("api");
    expect(SessionNames.fromTyped("Login: fix #2")).toBe("login-fix-2");
  });
});

describe("SessionNames.renameProblem", () => {
  it("accepts a new name nobody else has", () => {
    expect(SessionNames.renameProblem("synqed-auth", "synqed", ["synqed", "whisker"])).toBeUndefined();
  });

  it("refuses an empty name, a taken name and the same name", () => {
    expect(SessionNames.renameProblem("", "synqed", [])).toBe("Give it a name with a letter or a number.");
    expect(SessionNames.renameProblem("whisker", "synqed", ["synqed", "whisker"])).toBe("There is already a session called whisker.");
    expect(SessionNames.renameProblem("synqed", "synqed", ["synqed"])).toBe("It is already called synqed.");
  });

  it("refuses a name too long to say", () => {
    expect(SessionNames.renameProblem("a".repeat(41), "synqed", [])).toBe("Keep it to 40 characters.");
  });
});
