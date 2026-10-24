// Keeps every open UI in step: a full snapshot on connect and on every change, plus one-off messages.

import type { WebSocket } from "ws";
import type { ActionExecutor } from "../actions/action-executor.ts";
import type { Assistant } from "../conductor/assistant.ts";
import type { ProjectCatalog } from "../projects/project-catalog.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";
import type { SetupService } from "../setup/setup-service.ts";
import type { MacVoice } from "../voice/mac-voice.ts";
import type { ClientMessage, ServerMessage } from "../../shared/protocol.ts";

const snapshotThrottleMilliseconds = 50;

export class EventHub {
  private readonly sockets = new Set<WebSocket>();
  private snapshotTimer: NodeJS.Timeout | undefined;
  private projectNames: string[] = [];

  constructor(
    private readonly registry: SessionRegistry,
    private readonly executor: ActionExecutor,
    private readonly projects: ProjectCatalog,
    private readonly setup: SetupService,
    private readonly macVoice: MacVoice,
    private readonly assistant: Assistant,
  ) {
    assistant.on("conversation", (entries) => this.broadcast({ type: "conversation", entries }));
    assistant.on("say", (text) => this.broadcast({ type: "say", text }));
    registry.on("changed", () => this.scheduleSnapshot());
    executor.on("changed", () => this.scheduleSnapshot());
    executor.on("feedback", (feedback) => this.broadcast({ type: "feedback", feedback }));
    executor.on("focus", (session) => this.broadcast({ type: "focus", session }));
    executor.on("catchUp", (digests) => this.broadcast({ type: "catch_up", digests }));
    void this.refreshProjects();
  }

  connect(socket: WebSocket): void {
    this.sockets.add(socket);
    socket.send(JSON.stringify(this.snapshot()));
    socket.send(JSON.stringify({ type: "conversation", entries: this.assistant.conversation() } satisfies ServerMessage));
    void this.sendSetup();
    socket.on("message", (raw) => void this.receive(raw.toString()));
    socket.on("close", () => this.sockets.delete(socket));
  }

  private async receive(text: string): Promise<void> {
    let message: ClientMessage;
    try {
      message = JSON.parse(text) as ClientMessage;
    } catch {
      return;
    }
    try {
      if (message.type === "utterance") await this.executor.handleUtterance(String(message.text), message.source === "voice" ? "voice" : "keyboard");
      if (message.type === "action") await this.executor.perform(message.action, "click");
      if (message.type === "focus") this.executor.setFocus(String(message.session));
      if (message.type === "setup_refresh") await this.sendSetup();
      if (message.type === "set_project_roots") await this.changeProjectRoots(message.roots);
      if (message.type === "connect_existing_sessions") await this.connectExistingSessions(message.connected === true);
      if (message.type === "speak") this.macVoice.speak(String(message.text));
      if (message.type === "stop_speaking") this.macVoice.stop();
    } catch (error) {
      // A failed command is told to the user; it must never take the server down.
      const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
      this.broadcast({ type: "feedback", feedback: { text: `That did not work: ${reason}`, tone: "error", speak: true } });
    }
  }

  private async sendSetup(): Promise<void> {
    this.broadcast({ type: "setup", setup: await this.setup.status() });
  }

  private async changeProjectRoots(roots: unknown): Promise<void> {
    const missing = await this.setup.setProjectRoots(Array.isArray(roots) ? roots.map(String) : []);
    if (missing.length > 0) this.broadcast({ type: "feedback", feedback: { text: `Not found, left out: ${missing.join(", ")}`, tone: "warning", speak: false } });
    await this.refreshProjects();
    await this.sendSetup();
  }

  private async connectExistingSessions(connected: boolean): Promise<void> {
    await this.setup.setExistingSessionsConnected(connected);
    const text = connected
      ? "Connected. Claude sessions you start in any terminal now show up here."
      : "Disconnected. Callsign's hooks are out of your Claude settings.";
    this.broadcast({ type: "feedback", feedback: { text, tone: "success", speak: false } });
    await this.sendSetup();
  }

  private async refreshProjects(): Promise<void> {
    this.projectNames = (await this.projects.list()).map((project) => project.name);
    this.scheduleSnapshot();
  }

  private snapshot(): ServerMessage {
    return {
      type: "snapshot",
      sessions: this.registry.list(),
      recentlyClosed: this.registry.recentlyClosedSessions().map((session) => ({ name: session.name, projectName: session.projectName })),
      projects: this.projectNames,
      control: this.executor.controlState(),
      serverTime: Date.now(),
    };
  }

  private scheduleSnapshot(): void {
    this.snapshotTimer ??= setTimeout(() => {
      this.snapshotTimer = undefined;
      this.broadcast(this.snapshot());
    }, snapshotThrottleMilliseconds);
  }

  private broadcast(message: ServerMessage): void {
    const text = JSON.stringify(message);
    for (const socket of this.sockets) if (socket.readyState === socket.OPEN) socket.send(text);
  }
}
