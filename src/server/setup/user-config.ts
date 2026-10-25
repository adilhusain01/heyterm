// The user's choices from the Setup screen, in ~/.heyterm/config.json. Environment variables win over it.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface UserConfigValues {
  projectRoots?: string[];
  routerModel?: string;
  // Whether sessions started in the user's own terminals show up. HeyTerm adds its hooks to their
  // Claude settings while it runs and takes them out when it stops.
  showOwnTerminalSessions?: boolean;
  // Keep running after the last HeyTerm page is closed. Off by default: closing HeyTerm closes it.
  keepRunningWithoutPage?: boolean;
}

export class UserConfig {
  private readonly filePath: string;

  constructor(dataDirectory: string) {
    this.filePath = path.join(dataDirectory, "config.json");
  }

  async load(): Promise<UserConfigValues> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as UserConfigValues;
    } catch {
      return {};
    }
  }

  async update(change: UserConfigValues): Promise<UserConfigValues> {
    const next = { ...(await this.load()), ...change };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    return next;
  }
}
