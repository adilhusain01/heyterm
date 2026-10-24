// Starts Callsign: hooks, sessions, the router and the local server.

import path from "node:path";
import { ActionExecutor } from "./actions/action-executor.ts";
import { DecisionActions } from "./actions/decision-actions.ts";
import { SessionActions } from "./actions/session-actions.ts";
import { loadConfig } from "./config.ts";
import { HeldHookRequests } from "./hooks/held-hook-requests.ts";
import { ExistingSessionConnector } from "./hooks/existing-session-connector.ts";
import { HookInstaller } from "./hooks/hook-installer.ts";
import { CallsignHttpServer } from "./http/callsign-http-server.ts";
import { EventHub } from "./http/event-hub.ts";
import { RequestGuard } from "./http/request-guard.ts";
import { TerminalBridge } from "./http/terminal-bridge.ts";
import { ProjectCatalog } from "./projects/project-catalog.ts";
import { FastPathRouter } from "./router/fast-path-router.ts";
import { ModelRouter } from "./router/model-router.ts";
import { AuditLog } from "./safety/audit-log.ts";
import { SessionLauncher } from "./sessions/session-launcher.ts";
import { SessionRegistry } from "./sessions/session-registry.ts";
import { StateStore } from "./sessions/state-store.ts";
import { SetupService } from "./setup/setup-service.ts";
import { UserConfig } from "./setup/user-config.ts";
import { TrustDialogWatcher } from "./sessions/trust-dialog-watcher.ts";
import { isTmuxInstalled, TmuxServer } from "./tmux/tmux-server.ts";

// Starts every part of Callsign and resolves once the server is listening.
export async function startCallsign(): Promise<void> {
  const config = await loadConfig();
  if (!(await isTmuxInstalled())) {
    console.error("Callsign runs every session in tmux, and tmux is not installed. Install it with: brew install tmux");
    process.exit(1);
  }

  const hooks = await new HookInstaller(config.dataDirectory, config.port).install();
  const tmux = new TmuxServer(config.tmuxSocketName);
  const heldRequests = new HeldHookRequests();
  const store = new StateStore(config.dataDirectory);
  const registry = new SessionRegistry(store, heldRequests);
  const saved = await store.load();
  registry.restore(saved.sessions, saved.recentlyClosed);

  const launcher = new SessionLauncher(tmux, registry, hooks.settingsPath);
  await launcher.reconcileWithTmux();
  new TrustDialogWatcher(tmux, registry).start();

  const projects = new ProjectCatalog(config.projectRoots);
  const audit = new AuditLog(config.dataDirectory);
  const modelRouter = new ModelRouter(config.routerModel, path.join(config.dataDirectory, "router"));
  const executor = new ActionExecutor(
    registry,
    projects,
    new FastPathRouter(),
    modelRouter,
    new DecisionActions(registry, heldRequests, audit),
    new SessionActions(registry, launcher, projects, audit),
  );

  const connector = new ExistingSessionConnector(hooks.existingSessionScriptPath, path.join(config.dataDirectory, "backups"));
  const setup = new SetupService(projects, new UserConfig(config.dataDirectory), connector, config.routerModel);
  const hub = new EventHub(registry, executor, projects, setup);
  const guard = new RequestGuard(config.port, hooks.token, config.developmentOrigin);
  const server = new CallsignHttpServer(config.port, config.webDirectory, guard, registry, hub, new TerminalBridge(tmux));
  await server.listen();

  const sessionCount = registry.list().length;
  console.log(`Callsign is listening on http://127.0.0.1:${config.port}`);
  console.log(`Projects from: ${config.projectRoots.join(", ") || "no project folders found"}`);
  console.log(`Router: ${process.env.ANTHROPIC_API_KEY ? "Claude API" : "claude -p on your Claude Code login"} with ${config.routerModel}`);
  if (sessionCount > 0) console.log(`Picked up ${sessionCount} running session${sessionCount === 1 ? "" : "s"}.`);
}
