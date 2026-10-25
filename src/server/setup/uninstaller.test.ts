import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HookCommands } from "../hooks/hook-commands.ts";
import { Uninstaller } from "./uninstaller.ts";

async function makeHome() {
  const home = await mkdtemp(path.join(os.tmpdir(), "heyterm-home-"));
  const dataDirectory = path.join(home, ".heyterm");
  await mkdir(path.join(dataDirectory, "hooks"), { recursive: true });
  await writeFile(path.join(dataDirectory, "state.json"), "{}");
  const claudeSettingsPath = path.join(home, ".claude", "settings.json");
  await mkdir(path.dirname(claudeSettingsPath), { recursive: true });
  const userHook = { hooks: [{ type: "command", command: "/usr/local/bin/my-own-hook" }] };
  const heytermHook = { hooks: [{ type: "command", command: HookCommands.forExistingSessions(path.join(dataDirectory, "hooks", "heyterm-forward.cjs"), "Stop") }] };
  await writeFile(claudeSettingsPath, JSON.stringify({ model: "opus", hooks: { Stop: [userHook, heytermHook] } }));
  // Inside the made-up home, so no test can touch the user's real Grok and Cursor files.
  const agentHookPaths = { grokPath: path.join(home, ".grok", "hooks", "heyterm.json"), cursorPath: path.join(home, ".cursor", "hooks.json") };
  return { home, dataDirectory, claudeSettingsPath, userHook, agentHookPaths };
}

describe("Uninstaller", () => {
  it("takes HeyTerm's hooks out of the user's Claude settings and leaves everything else", async () => {
    const { dataDirectory, claudeSettingsPath, userHook, agentHookPaths } = await makeHome();
    const trashed: string[] = [];
    await new Uninstaller({ dataDirectory, claudeSettingsPath, moveToTrash: async (target) => void trashed.push(target), agentHookPaths }).run();
    expect(JSON.parse(await readFile(claudeSettingsPath, "utf8"))).toEqual({ model: "opus", hooks: { Stop: [userHook] } });
  });

  it("moves HeyTerm's own folder to the Trash rather than deleting it", async () => {
    const { dataDirectory, claudeSettingsPath, agentHookPaths } = await makeHome();
    const trashed: string[] = [];
    const report = await new Uninstaller({ dataDirectory, claudeSettingsPath, moveToTrash: async (target) => void trashed.push(target), agentHookPaths }).run();
    expect(trashed).toEqual([dataDirectory]);
    expect(report.removedHooks).toBe(true);
  });

  it("leaves the folder where it is, and says so, when there is no Trash to move it to", async () => {
    const { dataDirectory, claudeSettingsPath, agentHookPaths } = await makeHome();
    const report = await new Uninstaller({ dataDirectory, claudeSettingsPath, moveToTrash: async () => Promise.reject(new Error("no trash")), agentHookPaths }).run();
    expect((await stat(dataDirectory)).isDirectory()).toBe(true);
    expect(report.leftBehind).toEqual([dataDirectory]);
  });

  it("works when Claude Code has no settings file at all", async () => {
    const { dataDirectory, agentHookPaths } = await makeHome();
    const report = await new Uninstaller({ dataDirectory, claudeSettingsPath: "/no/such/settings.json", moveToTrash: async () => undefined, agentHookPaths }).run();
    expect(report.removedHooks).toBe(false);
  });

  it("takes HeyTerm's Grok Build and Cursor hooks out as well, leaving the user's own Cursor hooks", async () => {
    const { home, dataDirectory, claudeSettingsPath } = await makeHome();
    const grokPath = path.join(home, ".grok", "hooks", "heyterm.json");
    const cursorPath = path.join(home, ".cursor", "hooks.json");
    await mkdir(path.dirname(grokPath), { recursive: true });
    await mkdir(path.dirname(cursorPath), { recursive: true });
    await writeFile(grokPath, "{}");
    const usersOwn = { command: "./audit.sh" };
    await writeFile(cursorPath, JSON.stringify({ version: 1, hooks: { stop: [usersOwn, { command: HookCommands.forAgent("/x/heyterm-forward.cjs", "stop", "cursor") }] } }));
    await new Uninstaller({ dataDirectory, claudeSettingsPath, moveToTrash: async () => undefined, agentHookPaths: { grokPath, cursorPath } }).run();
    await expect(stat(grokPath)).rejects.toThrow();
    expect(JSON.parse(await readFile(cursorPath, "utf8"))).toEqual({ version: 1, hooks: { stop: [usersOwn] } });
  });
});

