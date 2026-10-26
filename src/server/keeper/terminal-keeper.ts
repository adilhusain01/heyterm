// The process the heyterm command runs. It owns the terminals and runs the server as its child, so
// the server can restart (new code on disk, heyterm restart, a crash) while the terminals, and the
// agents in them, keep running; the next server takes them over. Stopping HeyTerm on purpose
// (heyterm stop, Quit, the page closed, Ctrl+C) still ends every terminal. Rules in keeper-rules.ts.

import { fork, type ChildProcess } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { BundleWatch } from "./bundle-watch.ts";
import { ProcessChannel } from "./keeper-channel.ts";
import { KeeperRules } from "./keeper-rules.ts";
import { KeeperService } from "./keeper-service.ts";
import { TerminalHost } from "../terminals/terminal-host.ts";

// How long the server gets to stop by itself after a stop signal before the keeper ends it.
const serverStopGraceMilliseconds = 20_000;

export interface TerminalKeeperOptions {
  // The script that starts the server when run with HEYTERM_SERVER_CHILD=1.
  entryScript: string;
  // The server's built code, watched so a new build starts without ending the sessions.
  serverBundle: string;
  pidFile: string;
  openPageOnFirstStart: boolean;
}

export class TerminalKeeper {
  private readonly service = new KeeperService(new TerminalHost());
  private server: ChildProcess | undefined;
  private crashTimes: number[] = [];
  private restartTimer: NodeJS.Timeout | undefined;
  private isStopping = false;
  // Set once a server says it is listening, so a failed first start is told apart from a crash.
  private hasServerStartedOnce = false;
  private readonly bundleWatch: BundleWatch;

  constructor(private readonly options: TerminalKeeperOptions) {
    this.bundleWatch = new BundleWatch(options.serverBundle, () => this.startNewCode());
  }

  start(): void {
    writeFileSync(this.options.pidFile, String(process.pid), { mode: 0o600 });
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, () => this.stopOnSignal(signal));
    this.bundleWatch.start();
    this.startServer(this.options.openPageOnFirstStart);
  }

  private startServer(openPage: boolean): void {
    const server = fork(this.options.entryScript, [], {
      env: { ...process.env, HEYTERM_SERVER_CHILD: "1", ...(openPage ? { HEYTERM_OPEN_PAGE: "1" } : {}) },
      stdio: "inherit",
    });
    this.server = server;
    this.service.serve(ProcessChannel.toServer(server));
    server.on("message", (message: { type?: string }) => {
      if (message.type === "listening") this.hasServerStartedOnce = true;
    });
    server.on("exit", (exitCode) => {
      if (this.server === server) this.server = undefined;
      this.afterServerExit(exitCode);
    });
  }

  private afterServerExit(exitCode: number | null): void {
    if (this.isStopping) return this.endEverything();
    const now = Date.now();
    const decision = KeeperRules.afterServerExit({ exitCode, recentCrashTimes: KeeperRules.recentCrashes(this.crashTimes, now), now });
    if (decision.kind === "end_terminals") return this.endEverything();
    // A first start that failed (the port is taken, say) with nothing to keep is not retried.
    if (!this.hasServerStartedOnce && this.service.runningNames().length === 0) return this.endEverything(1);
    if (exitCode !== KeeperRules.restartExitCode) {
      this.crashTimes = [...KeeperRules.recentCrashes(this.crashTimes, now), now];
      console.error(`HeyTerm's server stopped unexpectedly (exit ${exitCode ?? "by a signal"}). Starting it again in ${Math.round(decision.afterMilliseconds / 100) / 10}s; the sessions keep running.`);
    }
    this.restartTimer = setTimeout(() => this.startServer(false), decision.afterMilliseconds);
  }

  // New server code on disk: the running server restarts itself into it, or, while a crashed one
  // waits for its next try, the new code starts at once.
  private startNewCode(): void {
    if (this.isStopping) return;
    if (this.server?.connected) {
      console.log("HeyTerm's code changed on disk. Restarting the server; the sessions keep running.");
      this.server.send({ type: "please_restart" });
      return;
    }
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = undefined;
      this.startServer(false);
    }
  }

  // Ctrl+C reaches the server too, which stops by itself; the keeper ends the terminals after it.
  private stopOnSignal(signal: NodeJS.Signals): void {
    if (this.isStopping) return;
    this.isStopping = true;
    clearTimeout(this.restartTimer);
    const server = this.server;
    if (!server) return this.endEverything();
    server.kill(signal === "SIGHUP" ? "SIGHUP" : "SIGTERM");
    setTimeout(() => {
      server.kill("SIGKILL");
      this.endEverything();
    }, serverStopGraceMilliseconds).unref();
  }

  private endEverything(exitCode = 0): void {
    this.bundleWatch.stop();
    this.service.endAll();
    rmSync(this.options.pidFile, { force: true });
    process.exit(exitCode);
  }
}
