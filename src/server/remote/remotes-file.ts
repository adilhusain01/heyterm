// The list of other computers in ~/.heyterm/remotes.json, written by `heyterm remote add` and
// `heyterm remote remove`. It holds each one's token, so it is readable by this user only.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RemoteHostRules, type RemoteHost } from "./remote-host-rules.ts";

export class RemotesFile {
  private readonly filePath: string;

  constructor(dataDirectory: string) {
    this.filePath = path.join(dataDirectory, "remotes.json");
  }

  async list(): Promise<RemoteHost[]> {
    return RemoteHostRules.readRemotes(await readFile(this.filePath, "utf8").catch(() => "[]"));
  }

  // Returns why the computer could not be added, or undefined once it is.
  async add(remote: RemoteHost): Promise<string | undefined> {
    if (RemoteHostRules.readRemotes(JSON.stringify([remote])).length === 0) {
      return "Use a short lowercase name (letters, digits, hyphens) and an https address, or http to this computer only, and pass the other HeyTerm's token on standard input.";
    }
    const others = (await this.list()).filter((known) => known.name !== remote.name);
    await this.write([...others, remote]);
    return undefined;
  }

  async remove(name: string): Promise<boolean> {
    const known = await this.list();
    if (!known.some((remote) => remote.name === name)) return false;
    await this.write(known.filter((remote) => remote.name !== name));
    return true;
  }

  private async write(remotes: RemoteHost[]): Promise<void> {
    await writeFile(this.filePath, `${JSON.stringify(remotes, null, 2)}\n`, { mode: 0o600 });
  }
}
