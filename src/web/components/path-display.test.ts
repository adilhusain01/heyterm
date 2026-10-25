import { describe, expect, it } from "vitest";
import { PathDisplay } from "./path-display.ts";

describe("PathDisplay.tail", () => {
  it("keeps the end of a long path, where the folder's own name is", () => {
    expect(PathDisplay.tail("/private/tmp/claude-501/scratchpad/projects/docs")).toBe("…/scratchpad/projects/docs");
  });

  it("leaves a short path whole", () => {
    expect(PathDisplay.tail("/Users/adil/web")).toBe("/Users/adil/web");
  });

  it("reads Windows paths too", () => {
    expect(PathDisplay.tail("C:\\Users\\adil\\Documents\\Projects\\api")).toBe("…\\Documents\\Projects\\api");
  });
});
