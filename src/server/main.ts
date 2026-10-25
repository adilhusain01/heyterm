// Starts HeyTerm: hooks, terminals, sessions, the assistant and the local server. Every way of
// stopping (the stop command, Ctrl+C, Quit in the page, closing the last page) ends in stop().

import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ActionExecutor } from "./actions/action-executor.ts";
import { DecisionActions } from "./actions/decision-actions.ts";
import { SessionActions } from "./actions/session-actions.ts";
import { createAssistant } from "./conductor/create-assistant.ts";
import { loadConfig } from "./config.ts";
import { ExistingSessionConnector } from "./hooks/existing-session-connector.ts";
import { HeldHookRequests } from "./hooks/held-hook-requests.ts";
import { HookInstaller } from "./hooks/hook-installer.ts";
import { HeyTermHttpServer } from "./http/heyterm-http-server.ts";
import { EventHub } from "./http/event-hub.ts";
import { RequestGuard } from "./http/request-guard.ts";
import { TerminalBridge } from "./http/terminal-bridge.ts";
import { ProjectCatalog } from "./projects/project-catalog.ts";
import { FastPathRouter } from "./router/fast-path-router.ts";
import { AuditLog } from "./safety/audit-log.ts";
import { SessionLauncher } from "./sessions/session-launcher.ts";
import { SessionRegistry } from "./sessions/session-registry.ts";
import { StateStore } from "./sessions/state-store.ts";
import { TrustDialogWatcher } from "./sessions/trust-dialog-watcher.ts";
import { SetupService } from "./setup/setup-service.ts";
import { InputLog } from "./setup/input-log.ts";
import { UserConfig } from "./setup/user-config.ts";
import { TerminalHost } from "./terminals/terminal-host.ts";
import { MacVoice } from "./voice/mac-voice.ts";

const execFileAsync = promisify(execFile);

// A reload or a moment offline is not closing HeyTerm; this long with no page open is.
const closedPageGraceMilliseconds = 15_000;

export interface RunningHeyTerm {
  url: string;
  token: string;
  stop(reason: string): Promise<void>;
}

export async function startHeyTerm(): Promise<RunningHeyTerm> {
  const config = await loadConfig();
  const userConfig = new UserConfig(config.dataDirectory);
  const savedChoices = await userConfig.load();
  const hooks = await new HookInstaller(config.dataDirectory, config.port).install();
  await stopSessionsFromOlderVersion(config.tmuxSocketName);

  const host = new TerminalHost();
  const heldRequests = new HeldHookRequests();
  const store = new StateStore(config.dataDirectory);
  const registry = new SessionRegistry(store, heldRequests);
  const saved = await store.load();
  registry.restore(saved.sessions, saved.recentlyClosed);

  const launcher = new SessionLauncher(host, registry, { claudeSettingsPath: hooks.settingsPath, forwardScriptPath: hooks.forwardScriptPath });
  launcher.restoreAfterStart();
  const trustWatcher = new TrustDialogWatcher(host, registry);
  trustWatcher.start();

  const projects = new ProjectCatalog(config.projectRoots);
  const audit = new AuditLog(config.dataDirectory);
  const decisions = new DecisionActions(registry, heldRequests, audit);
  const sessionActions = new SessionActions(registry, launcher, projects, audit);
  const executor = new ActionExecutor(registry, projects, new FastPathRouter({ sendUnaddressedWordsToFocusedSession: false }), decisions, sessionActions);
  const assistant = createAssistant({ model: config.routerModel, workingDirectory: os.homedir(), registry, launcher, projects, sessionActions, decisions, executor, audit });
  executor.attachAssistant(assistant);
  executor.on("feedback", (feedback) => assistant.recordOutcome(feedback.text));
  registry.on("changed", () => assistant.noteSessions(registry.list()));
  assistant.noteSessions(registry.list());

  // Sessions from the user's own terminals: hooks go into their Claude settings only while HeyTerm runs.
  const connector = new ExistingSessionConnector(hooks.forwardScriptPath, path.join(config.dataDirectory, "backups"));
  const showOwnTerminalSessions = savedChoices.showOwnTerminalSessions ?? (await connector.isConnected());
  if (savedChoices.showOwnTerminalSessions === undefined && showOwnTerminalSessions) await userConfig.update({ showOwnTerminalSessions });
  if (showOwnTerminalSessions) await connector.connect().catch((error: Error) => console.error(error.message));

  const setup = new SetupService(projects, userConfig, connector, config.routerModel);
  const hub = new EventHub(registry, executor, projects, setup, new MacVoice(), assistant);
  hub.inputLog = new InputLog(config.dataDirectory);
  const guard = new RequestGuard(config.port, hooks.token, config.developmentOrigin);
  const server = new HeyTermHttpServer(config.port, config.webDirectory, guard, registry, hub, new TerminalBridge(host));
  await server.listen();

  let closedPageTimer: NodeJS.Timeout | undefined;
  let stopping: Promise<void> | undefined;
  const stop = (reason: string): Promise<void> => {
    stopping ??= (async () => {
      console.log(`\nStopping HeyTerm (${reason}).`);
      clearTimeout(closedPageTimer);
      trustWatcher.stop();
      assistant.close();
      launcher.shutdown();
      // Leave the user's Claude settings as they were before HeyTerm started.
      if ((await userConfig.load()).showOwnTerminalSessions) await connector.disconnect().catch(() => undefined);
      await registry.saveNow().catch(() => undefined);
      await server.close();
      console.log("HeyTerm stopped. Its sessions are under Recently closed next time.");
    })();
    return stopping;
  };
  const stopAndExit = (reason: string) => void stop(reason).then(() => process.exit(0));

  let pageWasOpen = false;
  hub.onPageCountChange = (count) => {
    clearTimeout(closedPageTimer);
    if (count > 0) {
      pageWasOpen = true;
      return;
    }
    if (!pageWasOpen) return;
    closedPageTimer = setTimeout(() => {
      void userConfig.load().then((choices) => {
        if (!choices.keepRunningWithoutPage) stopAndExit("the last HeyTerm page was closed");
      });
    }, closedPageGraceMilliseconds);
  };
  hub.onQuitRequest = () => stopAndExit("Quit in the page");
  server.onShutdownRequest = () => stopAndExit("heyterm stop");
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.once(signal, () => stopAndExit(signal));

  const url = `http://127.0.0.1:${config.port}`;
  console.log(`HeyTerm is listening on ${url}`);
  console.log(`Projects from: ${config.projectRoots.join(", ") || "no project folders found"}`);
  console.log(`Assistant: ${config.routerModel} on ${process.env.ANTHROPIC_API_KEY ? "your Anthropic API key" : "your Claude Code login"}`);
  console.log("Stop it with Ctrl+C, heyterm stop, or Quit in the page.");
  return { url, token: hooks.token, stop };
}

// Versions before the move to HeyTerm's own terminals ran sessions in tmux. Those sessions are
// stopped here; their saved copies are offered under "Recently closed" to bring back.
async function stopSessionsFromOlderVersion(tmuxSocketName: string): Promise<void> {
  if (process.platform === "win32") return;
  await execFileAsync("tmux", ["-L", tmuxSocketName, "kill-server"], { timeout: 5_000 }).catch(() => undefined);
}
