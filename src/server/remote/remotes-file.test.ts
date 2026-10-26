import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RemotesFile } from "./remotes-file.ts";

const folders: string[] = [];
function file(): { remotes: RemotesFile; folder: string } {
  const folder = mkdtempSync(path.join(tmpdir(), "heyterm-remotes-"));
  folders.push(folder);
  return { remotes: new RemotesFile(folder), folder };
}
afterEach(() => folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true })));

describe("RemotesFile", () => {
  it("adds a computer, replaces one added again under the same name, and removes it", async () => {
    const { remotes } = file();
    expect(await remotes.add({ name: "vps", url: "https://vps.example.ts.net:8443", token: "first" })).toBeUndefined();
    await remotes.add({ name: "vps", url: "https://vps.example.ts.net:8443", token: "second" });
    expect(await remotes.list()).toEqual([{ name: "vps", url: "https://vps.example.ts.net:8443", token: "second" }]);
    expect(await remotes.remove("vps")).toBe(true);
    expect(await remotes.list()).toEqual([]);
  });

  // It holds each computer's token.
  it("keeps the file readable by this user only", async () => {
    const { remotes, folder } = file();
    await remotes.add({ name: "vps", url: "https://vps.example.ts.net:8443", token: "secret" });
    expect(statSync(path.join(folder, "remotes.json")).mode & 0o077).toBe(0);
  });

  it("refuses a plain http address on the network, with what to do instead", async () => {
    const { remotes } = file();
    expect(await remotes.add({ name: "vps", url: "http://vps.example.ts.net:8443", token: "secret" })).toContain("https");
    expect(await remotes.list()).toEqual([]);
  });
});
