import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FolderSuggestions } from "./folder-suggestions.ts";

// A home folder with a few folders and a file, the way a typed path sees it.
function home(): string {
  const folder = mkdtempSync(path.join(os.tmpdir(), "heyterm-home-"));
  for (const name of ["Documents", "Downloads", "Desktop", ".config", "Projects/api", "Projects/web"]) mkdirSync(path.join(folder, name), { recursive: true });
  writeFileSync(path.join(folder, "Documents.txt"), "");
  return folder;
}

describe("FolderSuggestions", () => {
  // Adil, 27 October 2026: start a session in any folder, the way VS Code opens one.
  it("suggests the folders a typed path could go on to, ignoring case and leaving out files", async () => {
    const homeFolder = home();
    const result = await FolderSuggestions.list("~/do", homeFolder);
    expect(result.suggestions.map((suggestion) => suggestion.shownPath)).toEqual(["~/Documents", "~/Downloads"]);
    expect(result.suggestions[0]!.path).toBe(path.join(homeFolder, "Documents"));
  });

  it("names the typed folder itself when it exists, so a session can start right there", async () => {
    const homeFolder = home();
    expect((await FolderSuggestions.list("~/Projects", homeFolder)).folder).toEqual({ path: path.join(homeFolder, "Projects"), shownPath: "~/Projects" });
    expect((await FolderSuggestions.list("~/Proj", homeFolder)).folder).toBeUndefined();
  });

  it("lists what is inside a folder typed with a slash at the end", async () => {
    const homeFolder = home();
    const result = await FolderSuggestions.list("~/Projects/", homeFolder);
    expect(result.folder?.shownPath).toBe("~/Projects");
    expect(result.suggestions.map((suggestion) => suggestion.shownPath)).toEqual(["~/Projects/api", "~/Projects/web"]);
  });

  it("leaves out hidden folders unless the typed name starts with a dot", async () => {
    const homeFolder = home();
    expect((await FolderSuggestions.list("~/", homeFolder)).suggestions.map((suggestion) => suggestion.shownPath)).not.toContain("~/.config");
    expect((await FolderSuggestions.list("~/.c", homeFolder)).suggestions.map((suggestion) => suggestion.shownPath)).toEqual(["~/.config"]);
  });

  it("takes a full path as well, and shows it as typed when it is outside the home folder", async () => {
    const homeFolder = home();
    const outside = mkdtempSync(path.join(os.tmpdir(), "heyterm-outside-"));
    mkdirSync(path.join(outside, "service"));
    const result = await FolderSuggestions.list(`${outside}/se`, homeFolder);
    expect(result.suggestions).toEqual([{ path: path.join(outside, "service"), shownPath: path.join(outside, "service") }]);
  });

  it("suggests nothing for a folder that does not exist", async () => {
    expect(await FolderSuggestions.list("~/no/such/place/", home())).toEqual({ suggestions: [] });
  });
});
