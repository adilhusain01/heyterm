// Settings, from the environment with sensible defaults.

import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DataFolder } from "./setup/data-folder.ts";
import { UserConfig } from "./setup/user-config.ts";

export interface HeyTermConfig {
  port: number;
  dataDirectory: string;
  projectRoots: string[];
  routerModel: string;
  // Only to stop sessions left by versions that ran them in tmux.
  tmuxSocketName: string;
  // A web origin allowed besides HeyTerm's own, for the Vite dev server.
  developmentOrigin?: string;
  webDirectory: string;
}

const defaultProjectRoots = ["Documents/Projects", "Projects", "code", "dev", "src", "Developer"];

// The built UI sits next to the bundled server (dist/server, dist/web), or under dist/ when run from source.
function builtWebDirectory(): string {
  const besideBundle = path.resolve(import.meta.dirname, "../web");
  return existsSync(path.join(besideBundle, "index.html")) ? besideBundle : path.resolve(import.meta.dirname, "../../dist/web");
}

// Environment variables first, then the Setup screen's choices, then defaults.
export async function loadConfig(): Promise<HeyTermConfig> {
  const home = os.homedir();
  if (!process.env.HEYTERM_DATA_DIRECTORY) await DataFolder.moveFromOldName(home).catch(() => undefined);
  const dataDirectory = process.env.HEYTERM_DATA_DIRECTORY ?? path.join(home, ".heyterm");
  const saved = await new UserConfig(dataDirectory).load();
  // Separated the way PATH is: ":" on macOS and Linux, ";" on Windows, where paths contain ":".
  const environmentRoots = process.env.HEYTERM_PROJECT_ROOTS?.split(path.delimiter).filter(Boolean);
  const projectRoots = environmentRoots ?? saved.projectRoots ?? defaultProjectRoots.map((root) => path.join(home, root)).filter((root) => existsSync(root));
  return {
    port: Number(process.env.HEYTERM_PORT ?? 4747),
    dataDirectory,
    projectRoots,
    routerModel: process.env.HEYTERM_ROUTER_MODEL ?? saved.routerModel ?? "claude-opus-5-5",
    tmuxSocketName: process.env.HEYTERM_TMUX_SOCKET ?? "callsign",
    developmentOrigin: process.env.HEYTERM_DEV_ORIGIN,
    webDirectory: builtWebDirectory(),
  };
}
