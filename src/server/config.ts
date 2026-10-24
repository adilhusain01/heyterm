// Settings, from the environment with sensible defaults.

import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { UserConfig } from "./setup/user-config.ts";

export interface CallsignConfig {
  port: number;
  dataDirectory: string;
  projectRoots: string[];
  routerModel: string;
  tmuxSocketName: string;
  // A web origin allowed besides Callsign's own, for the Vite dev server.
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
export async function loadConfig(): Promise<CallsignConfig> {
  const home = os.homedir();
  const dataDirectory = process.env.CALLSIGN_DATA_DIRECTORY ?? path.join(home, ".callsign");
  const saved = await new UserConfig(dataDirectory).load();
  const environmentRoots = process.env.CALLSIGN_PROJECT_ROOTS?.split(":").filter(Boolean);
  const projectRoots = environmentRoots ?? saved.projectRoots ?? defaultProjectRoots.map((root) => path.join(home, root)).filter((root) => existsSync(root));
  return {
    port: Number(process.env.CALLSIGN_PORT ?? 4747),
    dataDirectory,
    projectRoots,
    routerModel: process.env.CALLSIGN_ROUTER_MODEL ?? saved.routerModel ?? "claude-opus-5-5",
    tmuxSocketName: process.env.CALLSIGN_TMUX_SOCKET ?? "callsign",
    developmentOrigin: process.env.CALLSIGN_DEV_ORIGIN,
    webDirectory: builtWebDirectory(),
  };
}
