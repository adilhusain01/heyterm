import { mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ProjectCatalog } from "./project-catalog.ts";

describe("ProjectCatalog.find", () => {
  it("finds any existing folder by its path, not only the projects it listed", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "callsign-folder-"));
    await mkdir(path.join(folder, "Projects"));
    const catalog = new ProjectCatalog([]);
    expect(await catalog.find(path.join(folder, "Projects"))).toEqual({ name: "projects", path: path.join(folder, "Projects") });
  });

  it("reads ~ as the home folder", async () => {
    const catalog = new ProjectCatalog([]);
    expect((await catalog.find("~"))?.path).toBe(os.homedir());
  });

  it("finds nothing for a path that does not exist or is a file", async () => {
    const catalog = new ProjectCatalog([]);
    expect(await catalog.find("/no/such/folder/anywhere")).toBeUndefined();
    expect(await catalog.find(path.join(os.homedir(), ".zshrc-that-is-not-a-folder-xyz"))).toBeUndefined();
  });
});
