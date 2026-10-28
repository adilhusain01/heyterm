// Starts HeyTerm: hooks, terminals, sessions, the assistant and the local server. Every way of
// stopping (the stop command, Ctrl+C, Quit in the page, closing the last page) ends in stop().
// Run by the terminal keeper (keeper/terminal-keeper.ts), it can also restart(): the server goes
// and comes back with new code while the keeper keeps the terminals, and the sessions in them, running.

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ActionExecutor } from "./actions/action-executor.ts";
import { DecisionActions } from "./actions/decision-actions.ts";
import { SessionActions } from "./actions/session-actions.ts";
import { createAssistant } from "./conductor/create-assistant.ts";
import { AssistantMemory } from "./conductor/assistant-memory.ts";
import { loadConfig } from "./config.ts";
import { RemoteHosts } from "./remote/remote-hosts.ts";
import { PagePresence } from "./http/page-presence.ts";
import { AttachmentRules } from "./attachments/attachment-rules.ts";
import { acceptsText } from "./router/fast-path-router.ts";
import { ExistingSessionConnector } from "./hooks/existing-session-connector.ts";
import { HeldHookRequests } from "./hooks/held-hook-requests.ts";
import { AgentHookFiles } from "./hooks/agent-hook-files.ts";
import { HookInstaller } from "./hooks/hook-installer.ts";
import { HeyTermHttpServer } from "./http/heyterm-http-server.ts";
import { PageEntryOnDisk } from "./http/page-entry-on-disk.ts";
import { KeeperRules } from "./keeper/keeper-rules.ts";
import type { KeptTerminals } from "./keeper/kept-terminals.ts";
import { EventHub } from "./http/event-hub.ts";
import { PairingTickets } from "./http/pairing-tickets.ts";
import { RequestGuard } from "./http/request-guard.ts";
import { TerminalBridge } from "./http/terminal-bridge.ts";
import { FolderDialog } from "./projects/folder-dialog.ts";
import { ProjectCatalog } from "./projects/project-catalog.ts";
import { FastPathRouter } from "./router/fast-path-router.ts";
import { AuditLog } from "./safety/audit-log.ts";
import { SessionLauncher } from "./sessions/session-launcher.ts";
import { SessionRegistry } from "./sessions/session-registry.ts";
import { StateStore } from "./sessions/state-store.ts";
import { TrustDialogWatcher } from "./sessions/trust-dialog-watcher.ts";
import { ClaudeSessionWatcher } from "./sessions/claude-session-watcher.ts";
import { TurnChangeTracker } from "./sessions/turn-change-tracker.ts";
import { SessionWorktrees } from "./sessions/session-worktrees.ts";
import { DataFolder } from "./setup/data-folder.ts";
import { SetupService } from "./setup/setup-service.ts";
import { InputLog } from "./setup/input-log.ts";
import { UserConfig } from "./setup/user-config.ts";
import { TerminalHost } from "./terminals/terminal-host.ts";
import { MacVoice } from "./voice/mac-voice.ts";

const execFileAsync = promisify(execFile);

// A reload is not closing HeyTerm; this long after the last page closed on purpose is. A page that
// only lost its connection never stops it (page-presence.ts).
const closedPageGraceMilliseconds = 15_000;

export interface RunningHeyTerm {
  url: string;
  // A one-time ticket for opening the page; the token itself never goes into an address.
  issueTicket(): string;
  stop(reason: string): Promise<void>;
}

export interface KeeperConnection {
  terminals: KeptTerminals;
  // The terminals that outlived the last server: their sessions carry on.
  runningTerminalNames: string[];
}

export async function startHeyTerm(keeper?: KeeperConnection): Promise<RunningHeyTerm> {
  // A stray rejected promise is logged, not allowed to take every running session down with the server.
  process.on("unhandledRejection", (reason) => console.error("HeyTerm caught an unexpected error:", reason instanceof Error ? reason.message : reason));
  const config = await loadConfig();
  await DataFolder.ensurePrivate(config.dataDirectory);
  const userConfig = new UserConfig(config.dataDirectory);
  const savedChoices = await userConfig.load();
  const hooks = await new HookInstaller(config.dataDirectory, config.port).install();
  // Grok Build and Cursor take hooks only from global files: in place while HeyTerm runs.
  const agentHookFiles = new AgentHookFiles(hooks.forwardScriptPath, path.join(config.dataDirectory, "backups"));
  await agentHookFiles.install().catch((error: Error) => console.error(`Could not add HeyTerm's Grok and Cursor hooks: ${error.message}`));
  const quietTimer = setInterval(() => registry.noticeQuietSessions(Date.now()), 30_000);
  const hookRepairTimer = setInterval(() => {
    agentHookFiles
      .repairIfRemoved()
      .then((repaired) => repaired && console.log("Put HeyTerm's Grok and Cursor hooks back; something had removed them."))
      .catch(() => undefined);
    void userConfig
      .load()
      .then(async (choices) => choices.showOwnTerminalSessions === true && (await connector.repairIfRemoved()))
      .then((repaired) => repaired && console.log("Put HeyTerm's hooks back in your Claude settings; something had removed them."))
      .catch(() => undefined);
  }, 30_000);
  await stopSessionsFromOlderVersion(config.tmuxSocketName);

  const host = keeper?.terminals ?? new TerminalHost();
  const heldRequests = new HeldHookRequests();
  const store = new StateStore(config.dataDirectory);
  const registry = new SessionRegistry(store, heldRequests);
  const saved = await store.load();
  registry.restore(saved.sessions, saved.recentlyClosed);
  registry.useTurnChangeTracker(new TurnChangeTracker());

  const launcher = new SessionLauncher(host, registry, { claudeSettingsPath: hooks.settingsPath, forwardScriptPath: hooks.forwardScriptPath }, new SessionWorktrees(config.dataDirectory));
  launcher.restoreAfterStart(keeper?.runningTerminalNames ?? []);
  const keptCount = keeper?.runningTerminalNames.filter((name) => registry.get(name)).length ?? 0;
  if (keptCount > 0) console.log(`${keptCount === 1 ? "One session" : `${keptCount} sessions`} kept running through the restart.`);
  const trustWatcher = new TrustDialogWatcher(host, registry);
  trustWatcher.start();
  const claudeSessionWatcher = new ClaudeSessionWatcher(registry, async () => (await userConfig.load()).showOwnTerminalSessions === true, host);
  claudeSessionWatcher.start();

  const projects = new ProjectCatalog(config.projectRoots);
  const audit = new AuditLog(config.dataDirectory);
  const decisions = new DecisionActions(registry, heldRequests, audit);
  const sessionActions = new SessionActions(registry, launcher, projects, audit);
  // Sessions on other computers' HeyTerm (remotes.json): shown here as "host/name", acted on there.
  const remoteHosts = config.remotes.length > 0 ? new RemoteHosts(registry, config.remotes) : undefined;
  if (remoteHosts) {
    sessionActions.useRemoteHosts(remoteHosts);
    decisions.useRemoteHosts(remoteHosts);
  }
  const executor = new ActionExecutor(registry, projects, new FastPathRouter({ sendUnaddressedWordsToFocusedSession: false }), decisions, sessionActions);
  const assistant = createAssistant({ permissionChoice: savedChoices.assistantPermissions ?? "ask", model: config.routerModel, workingDirectory: os.homedir(), memory: new AssistantMemory(config.dataDirectory), registry, launcher, projects, sessionActions, decisions, executor, audit, ...(remoteHosts ? { remote: remoteHosts } : {}) });
  executor.attachAssistant(assistant);
  executor.on("feedback", (feedback) => assistant.recordOutcome(feedback.text));
  // A HeyTerm serving another one has nobody to talk to: the other one's assistant does the talking.
  if (!config.remoteHost) {
    registry.on("changed", () => assistant.noteSessions(registry.list()));
    assistant.noteSessions(registry.list());
  }

  // Sessions from the user's own terminals: hooks go into their Claude settings only while HeyTerm runs.
  const connector = new ExistingSessionConnector(hooks.forwardScriptPath, path.join(config.dataDirectory, "backups"));
  // On a computer serving another HeyTerm, the sessions started there by hand (claude-keep on a VPS) are the point.
  const showOwnTerminalSessions = savedChoices.showOwnTerminalSessions ?? (config.remoteHost || (await connector.isConnected()));
  if (savedChoices.showOwnTerminalSessions === undefined && showOwnTerminalSessions) await userConfig.update({ showOwnTerminalSessions });
  if (showOwnTerminalSessions) await connector.connect().catch((error: Error) => console.error(error.message));

  const setup = new SetupService(projects, userConfig, connector, config.routerModel);
  const pageEntry = new PageEntryOnDisk(config.webDirectory);
  const hub = new EventHub(registry, executor, projects, setup, new MacVoice(), assistant, () => pageEntry.current());
  hub.inputLog = new InputLog(config.dataDirectory);
  const guard = new RequestGuard(config.port, hooks.token, config.developmentOrigin, config.acceptedHostNames);
  const tickets = new PairingTickets(hooks.token);
  const server = new HeyTermHttpServer(config.port, config.webDirectory, guard, registry, hub, new TerminalBridge(host, remoteHosts), tickets);
  await server.listen();
  remoteHosts?.on("feedback", (feedback) => hub.tellPages(feedback));
  remoteHosts?.start();

  let closedPageTimer: NodeJS.Timeout | undefined;
  let stopping: Promise<void> | undefined;
  const stop = (reason: string): Promise<void> => {
    stopping ??= (async () => {
      console.log(`\nStopping HeyTerm (${reason}).`);
      clearTimeout(closedPageTimer);
      clearInterval(hookRepairTimer);
      clearInterval(quietTimer);
      trustWatcher.stop();
      claudeSessionWatcher.stop();
      assistant.close();
      remoteHosts?.stop();
      launcher.shutdown();
      // Leave the user's Claude settings as they were before HeyTerm started.
      if ((await userConfig.load()).showOwnTerminalSessions) await connector.disconnect().catch(() => undefined);
      await agentHookFiles.remove().catch(() => undefined);
      await registry.saveNow().catch(() => undefined);
      await server.close();
      console.log("HeyTerm stopped. Its sessions are under Recently closed next time.");
    })();
    return stopping;
  };
  const stopAndExit = (reason: string) => void stop(reason).then(() => process.exit(0));

  // The server goes and the keeper starts it again with the code on disk. The terminals, their hooks
  // and the settings stay as they are; only what this process holds is let go of.
  const restartAndExit = (reason: string) => {
    if (!keeper) return stopAndExit(reason);
    stopping ??= (async () => {
      console.log(`\nRestarting HeyTerm (${reason}). The sessions keep running.`);
      clearTimeout(closedPageTimer);
      clearInterval(hookRepairTimer);
      clearInterval(quietTimer);
      trustWatcher.stop();
      claudeSessionWatcher.stop();
      assistant.close();
      remoteHosts?.stop();
      await registry.saveNow().catch(() => undefined);
      await server.close();
    })();
    void stopping.then(() => process.exit(KeeperRules.restartExitCode));
  };
  keeper?.terminals.on("restart", () => restartAndExit("its code changed on disk"));

  let pageWasOpen = false;
  hub.onPageCountChange = (count, lastPageLeftOnPurpose) => {
    clearTimeout(closedPageTimer);
    if (count > 0) {
      pageWasOpen = true;
      return;
    }
    if (pageWasOpen && !lastPageLeftOnPurpose) console.log("The page lost its connection. HeyTerm keeps running and the page reconnects by itself.");
    closedPageTimer = setTimeout(() => {
      void userConfig.load().then((choices) => {
        const facts = { openPageCount: count, pageWasOpen, lastPageLeftOnPurpose, keepRunningWithoutPage: config.remoteHost || choices.keepRunningWithoutPage === true };
        if (PagePresence.shouldStopSoon(facts)) stopAndExit("the last HeyTerm page was closed");
      });
    }, closedPageGraceMilliseconds);
  };
  hub.onQuitRequest = () => stopAndExit("Quit in the page");
  server.onShutdownRequest = () => stopAndExit("heyterm stop");
  server.onChooseFolder = () => FolderDialog.choose();
  if (keeper) server.onRestartRequest = () => restartAndExit("heyterm restart");
  server.onAttachment = async (sessionName, bytes, contentType) => {
    if (remoteHosts?.isRemote(sessionName)) return remoteHosts.attach(sessionName, bytes, contentType);
    const session = registry.get(sessionName);
    if (!session) return { ok: false, text: `There is no session called ${sessionName}.` };
    if (session.origin === "external") return { ok: false, text: `${sessionName} runs in your own terminal, so HeyTerm cannot type into it. Say "open ${sessionName} here" first.` };
    if (!acceptsText(session)) return { ok: false, text: `${sessionName} is waiting on a decision. Answer it, then drop the image again.` };
    const folder = path.join(config.dataDirectory, "attachments");
    await mkdir(folder, { recursive: true });
    const filePath = path.join(folder, AttachmentRules.fileName(sessionName, AttachmentRules.extensionFor(contentType)!, new Date(), randomBytes(2).toString("hex")));
    await writeFile(filePath, bytes, { mode: 0o600 });
    launcher.pasteIntoPrompt(sessionName, AttachmentRules.pastedText(filePath));
    return { ok: true, text: `Attached the image to ${sessionName}. Add your words and send it.` };
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.once(signal, () => stopAndExit(signal));

  const url = `http://127.0.0.1:${config.port}`;
  console.log(`HeyTerm is listening on ${url}`);
  console.log(`Projects from: ${config.projectRoots.join(", ") || "no project folders found"}`);
  console.log(`Assistant: ${config.routerModel} on ${process.env.ANTHROPIC_API_KEY ? "your Anthropic API key" : "your Claude Code login"}`);
  if (config.remoteHost) console.log(`Serving another HeyTerm${config.acceptedHostNames.length > 0 ? `, which reaches it as ${config.acceptedHostNames.join(" or ")}` : ""}. Its sessions keep running while the other computer sleeps.`);
  for (const remote of config.remotes) console.log(`Showing the sessions of ${remote.name} (${remote.url}) as ${remote.name}/...`);
  console.log("Stop it with Ctrl+C, heyterm stop, or Quit in the page.");
  return { url, issueTicket: () => tickets.issue(), stop };
}

// Versions before the move to HeyTerm's own terminals ran sessions in tmux. Those sessions are
// stopped here; their saved copies are offered under "Recently closed" to bring back.
async function stopSessionsFromOlderVersion(tmuxSocketName: string): Promise<void> {
  if (process.platform === "win32") return;
  await execFileAsync("tmux", ["-L", tmuxSocketName, "kill-server"], { timeout: 5_000 }).catch(() => undefined);
}
