// The user's choices from the Setup screen, in ~/.callsign/config.json. Environment variables win over it.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface UserConfigValues {
  projectRoots?: string[];
  routerModel?: string;
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
