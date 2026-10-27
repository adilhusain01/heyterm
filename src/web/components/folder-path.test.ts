import { describe, expect, it } from "vitest";
import { FolderPath } from "./folder-path.ts";

describe("FolderPath.looksLikePath", () => {
  it("treats text starting like a path as a folder to open, and anything else as a project to find", () => {
    for (const text of ["~", "~/Documents", "/Users/adil", "C:\\Users\\adil", "d:/code"]) expect(FolderPath.looksLikePath(text)).toBe(true);
    for (const text of ["", "whisker", "synq ai", "web-app"]) expect(FolderPath.looksLikePath(text)).toBe(false);
  });
});
