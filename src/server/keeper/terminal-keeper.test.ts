import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TerminalKeeper } from "./terminal-keeper.ts";

const posixOnly = process.platform === "win32" ? describe.skip : describe;
const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

posixOnly("TerminalKeeper.serverEntryScript", () => {
  // npm makes the command's link last when it updates a package, so on 30 October 2026 the VPS
  // server, started through /usr/local/bin/heyterm, could not be found for seconds after the
  // keeper saw the new code.
  it("starts the server from the package's own script, not the command's link", () => {
    const prefix = mkdtempSync(path.join(tmpdir(), "heyterm-entry-"));
    folders.push(prefix);
    const script = path.join(prefix, "lib", "node_modules", "heyterm", "bin", "heyterm.js");
    mkdirSync(path.dirname(script), { recursive: true });
    writeFileSync(script, "");
    mkdirSync(path.join(prefix, "bin"));
    symlinkSync(script, path.join(prefix, "bin", "heyterm"));
    expect(TerminalKeeper.serverEntryScript(path.join(prefix, "bin", "heyterm"))).toBe(realpathSync(script));
  });

  it("keeps a script it cannot resolve as it was given", () => {
    expect(TerminalKeeper.serverEntryScript("/no/such/heyterm")).toBe("/no/such/heyterm");
  });
});
