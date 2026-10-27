import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FolderByName } from "./folder-by-name.ts";

function home(): string {
  const folder = mkdtempSync(path.join(os.tmpdir(), "heyterm-home-"));
  for (const name of ["Downloads", "Documents/notes", "Documents/Projects/notes", "Projects/api/node_modules/downloads", ".cache/downloads", "Work/site", "Clients/site"]) mkdirSync(path.join(folder, name), { recursive: true });
  return folder;
}

describe("FolderByName", () => {
  // Said out loud, "open a terminal in downloads" names a folder, not a project or a path.
  it("finds a folder in the home folder by its name, ignoring case", async () => {
    const homeFolder = home();
    expect(await FolderByName.find("downloads", homeFolder)).toEqual({ found: path.join(homeFolder, "Downloads") });
  });

  it("takes the shallowest match when the same name is also deeper down", async () => {
    const homeFolder = home();
    expect(await FolderByName.find("notes", homeFolder)).toEqual({ found: path.join(homeFolder, "Documents", "notes") });
  });

  it("names every match at the same depth, so the assistant asks which one", async () => {
    const homeFolder = home();
    expect(await FolderByName.find("site", homeFolder)).toEqual({ several: [path.join(homeFolder, "Clients", "site"), path.join(homeFolder, "Work", "site")] });
  });

  it("does not look inside hidden folders or dependencies", async () => {
    const homeFolder = home();
    expect(await FolderByName.find("nothing-like-this", homeFolder)).toEqual({});
    expect((await FolderByName.find("downloads", homeFolder)).several).toBeUndefined();
  });
});
