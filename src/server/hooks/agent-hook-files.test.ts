import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AgentHookFiles } from "./agent-hook-files.ts";

async function makeHome(withGrok: boolean, withCursor: boolean) {
  const home = await mkdtemp(path.join(os.tmpdir(), "heyterm-agent-hooks-"));
  if (withGrok) await mkdir(path.join(home, ".grok"));
  if (withCursor) await mkdir(path.join(home, ".cursor"));
  return { home, grokPath: path.join(home, ".grok", "hooks", "heyterm.json"), cursorPath: path.join(home, ".cursor", "hooks.json"), backups: path.join(home, "backups") };
}

describe("AgentHookFiles", () => {
  it("writes Grok's file and adds to Cursor's while HeyTerm runs, and takes both out when it stops", async () => {
    const paths = await makeHome(true, true);
    await writeFile(paths.cursorPath, JSON.stringify({ version: 1, hooks: { stop: [{ command: "./audit.sh" }] } }));
    const files = new AgentHookFiles("/data/heyterm-forward.cjs", paths.backups, paths);
    await files.install();
    expect(await readFile(paths.grokPath, "utf8")).toContain("agent Stop grok");
    expect(await readFile(paths.cursorPath, "utf8")).toContain("agent stop cursor");
    await files.remove();
    await expect(readFile(paths.grokPath, "utf8")).rejects.toThrow();
    expect(JSON.parse(await readFile(paths.cursorPath, "utf8"))).toEqual({ version: 1, hooks: { stop: [{ command: "./audit.sh" }] } });
  });

  it("touches nothing for an agent that is not installed", async () => {
    const paths = await makeHome(false, false);
    await new AgentHookFiles("/data/heyterm-forward.cjs", paths.backups, paths).install();
    await expect(readFile(paths.grokPath, "utf8")).rejects.toThrow();
    await expect(readFile(paths.cursorPath, "utf8")).rejects.toThrow();
  });

  it("leaves a Cursor file it cannot read exactly as it was", async () => {
    const paths = await makeHome(false, true);
    await writeFile(paths.cursorPath, "{ not json");
    await new AgentHookFiles("/data/heyterm-forward.cjs", paths.backups, paths).install();
    expect(await readFile(paths.cursorPath, "utf8")).toBe("{ not json");
  });

  it("leaves no Cursor file behind when it created one that holds nothing else", async () => {
    const paths = await makeHome(false, true);
    const files = new AgentHookFiles("/data/heyterm-forward.cjs", paths.backups, paths);
    await files.install();
    await files.remove();
    await expect(readFile(paths.cursorPath, "utf8")).rejects.toThrow();
  });

  // Seen on 25 October 2026: ~/.cursor/hooks.json vanished while HeyTerm ran, and Cursor sessions
  // stopped reporting until it was put back by hand.
  it("puts its hooks back while it runs when something removed them", async () => {
    const paths = await makeHome(true, true);
    const files = new AgentHookFiles("/data/heyterm-forward.cjs", paths.backups, paths);
    await files.install();
    await rm(paths.cursorPath);
    await rm(paths.grokPath);
    expect(await files.repairIfRemoved()).toBe(true);
    expect(await readFile(paths.cursorPath, "utf8")).toContain("agent stop cursor");
    expect(await readFile(paths.grokPath, "utf8")).toContain("agent Stop grok");
  });

  it("leaves its hooks alone when they are still there, without another backup", async () => {
    const paths = await makeHome(true, true);
    await writeFile(paths.cursorPath, JSON.stringify({ version: 1, hooks: {} }));
    const files = new AgentHookFiles("/data/heyterm-forward.cjs", paths.backups, paths);
    await files.install();
    const backupsAfterInstall = await readdir(paths.backups);
    expect(await files.repairIfRemoved()).toBe(false);
    expect(await readdir(paths.backups)).toEqual(backupsAfterInstall);
  });

  it("does not put back hooks after it has taken them out on stop", async () => {
    const paths = await makeHome(false, true);
    const files = new AgentHookFiles("/data/heyterm-forward.cjs", paths.backups, paths);
    await files.install();
    await files.remove();
    expect(await files.repairIfRemoved()).toBe(false);
    await expect(readFile(paths.cursorPath, "utf8")).rejects.toThrow();
  });
});
