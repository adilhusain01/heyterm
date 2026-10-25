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
  return { home, dataDirectory, claudeSettingsPath, userHook };
}

describe("Uninstaller", () => {
  it("takes HeyTerm's hooks out of the user's Claude settings and leaves everything else", async () => {
    const { dataDirectory, claudeSettingsPath, userHook } = await makeHome();
    const trashed: string[] = [];
    await new Uninstaller({ dataDirectory, claudeSettingsPath, moveToTrash: async (target) => void trashed.push(target) }).run();
    expect(JSON.parse(await readFile(claudeSettingsPath, "utf8"))).toEqual({ model: "opus", hooks: { Stop: [userHook] } });
  });

  it("moves HeyTerm's own folder to the Trash rather than deleting it", async () => {
    const { dataDirectory, claudeSettingsPath } = await makeHome();
    const trashed: string[] = [];
    const report = await new Uninstaller({ dataDirectory, claudeSettingsPath, moveToTrash: async (target) => void trashed.push(target) }).run();
    expect(trashed).toEqual([dataDirectory]);
    expect(report.removedHooks).toBe(true);
  });

  it("leaves the folder where it is, and says so, when there is no Trash to move it to", async () => {
    const { dataDirectory, claudeSettingsPath } = await makeHome();
    const report = await new Uninstaller({ dataDirectory, claudeSettingsPath, moveToTrash: async () => Promise.reject(new Error("no trash")) }).run();
    expect((await stat(dataDirectory)).isDirectory()).toBe(true);
    expect(report.leftBehind).toEqual([dataDirectory]);
  });

  it("works when Claude Code has no settings file at all", async () => {
    const { dataDirectory } = await makeHome();
    const report = await new Uninstaller({ dataDirectory, claudeSettingsPath: "/no/such/settings.json", moveToTrash: async () => undefined }).run();
    expect(report.removedHooks).toBe(false);
  });
});
