import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DataFolder } from "./data-folder.ts";

describe("DataFolder.moveFromOldName", () => {
  it("moves ~/.callsign to ~/.heyterm the first time, keeping everything in it", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "heyterm-move-"));
    await mkdir(path.join(home, ".callsign"));
    await writeFile(path.join(home, ".callsign", "state.json"), '{"sessions":[]}');
    await DataFolder.moveFromOldName(home);
    expect(await readFile(path.join(home, ".heyterm", "state.json"), "utf8")).toBe('{"sessions":[]}');
    await expect(stat(path.join(home, ".callsign"))).rejects.toThrow();
  });

  it("leaves both alone when ~/.heyterm already exists", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "heyterm-move-"));
    await mkdir(path.join(home, ".callsign"));
    await mkdir(path.join(home, ".heyterm"));
    await DataFolder.moveFromOldName(home);
    expect((await stat(path.join(home, ".callsign"))).isDirectory()).toBe(true);
  });

  it("does nothing when there is no old folder", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "heyterm-move-"));
    await DataFolder.moveFromOldName(home);
    await expect(stat(path.join(home, ".heyterm"))).rejects.toThrow();
  });
});
