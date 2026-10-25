import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ExistingSessionConnector } from "./existing-session-connector.ts";

const folders: string[] = [];
const settingsPathBefore = process.env.HEYTERM_CLAUDE_SETTINGS_PATH;
function connectorWithSettings(settings: object): { connector: ExistingSessionConnector; settingsPath: string } {
  const folder = mkdtempSync(path.join(tmpdir(), "heyterm-connector-"));
  folders.push(folder);
  const settingsPath = path.join(folder, "settings.json");
  writeFileSync(settingsPath, JSON.stringify(settings));
  process.env.HEYTERM_CLAUDE_SETTINGS_PATH = settingsPath;
  return { connector: new ExistingSessionConnector("/hooks/heyterm-forward.cjs", path.join(folder, "backups")), settingsPath };
}

afterEach(() => {
  process.env.HEYTERM_CLAUDE_SETTINGS_PATH = settingsPathBefore;
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe("ExistingSessionConnector.repairIfRemoved", () => {
  // Claude Code and other tools rewrite ~/.claude/settings.json; sessions in the user's own
  // terminals then stopped showing in HeyTerm with nothing saying why.
  it("puts HeyTerm's hooks back when the user had connected their own sessions", async () => {
    const { connector, settingsPath } = connectorWithSettings({ model: "opus" });
    expect(await connector.repairIfRemoved()).toBe(true);
    expect(await connector.isConnected()).toBe(true);
    expect(JSON.parse(readFileSync(settingsPath, "utf8")).model).toBe("opus");
  });

  it("leaves hooks that are in place alone", async () => {
    const { connector } = connectorWithSettings({});
    await connector.connect();
    expect(await connector.repairIfRemoved()).toBe(false);
  });
});
