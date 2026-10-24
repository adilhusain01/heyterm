import { describe, expect, it } from "vitest";
import { ExternalSessionNaming } from "./external-session-naming.ts";

describe("ExternalSessionNaming.nameFor", () => {
  it("uses the session's title when it has one", () => {
    expect(ExternalSessionNaming.nameFor({ sessionTitle: "Auth Refactor", workingDirectory: "/code/api" }, [])).toBe("auth-refactor");
  });

  it("uses the folder name when the session has no title", () => {
    expect(ExternalSessionNaming.nameFor({ workingDirectory: "/Users/dev/Projects/Peeker" }, [])).toBe("peeker");
  });

  it("adds a number when the name is taken", () => {
    expect(ExternalSessionNaming.nameFor({ workingDirectory: "/code/peeker" }, ["peeker", "peeker-2"])).toBe("peeker-3");
  });

  it("falls back to a generic name", () => {
    expect(ExternalSessionNaming.nameFor({ sessionTitle: "!!!", workingDirectory: "/" }, [])).toBe("session");
  });
});
