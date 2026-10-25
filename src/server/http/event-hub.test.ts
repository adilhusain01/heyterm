import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { EventHub } from "./event-hub.ts";
import type { WebSocket } from "ws";
import type { ActionExecutor } from "../actions/action-executor.ts";
import type { Assistant } from "../conductor/assistant.ts";
import type { ProjectCatalog } from "../projects/project-catalog.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";
import type { SetupService } from "../setup/setup-service.ts";
import type { MacVoice } from "../voice/mac-voice.ts";

class FakePage extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  readonly sent: Array<{ type: string }> = [];
  send(text: string): void {
    this.sent.push(JSON.parse(text) as { type: string });
  }
  say(message: object): void {
    this.emit("message", Buffer.from(JSON.stringify(message)));
  }
}

function hub(): EventHub {
  const registry = Object.assign(new EventEmitter(), { list: () => [], recentlyClosedSessions: () => [] });
  const executor = Object.assign(new EventEmitter(), { controlState: () => ({ mode: "quiet" }) });
  const assistant = Object.assign(new EventEmitter(), { conversation: () => [] });
  return new EventHub(
    registry as unknown as SessionRegistry,
    executor as unknown as ActionExecutor,
    { list: async () => [] } as unknown as ProjectCatalog,
    { status: async () => ({}) } as unknown as SetupService,
    {} as MacVoice,
    assistant as unknown as Assistant,
  );
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("EventHub", () => {
  it("answers a page that asks whether its connection is still alive, and only that page", async () => {
    const eventHub = hub();
    const asking = new FakePage();
    const other = new FakePage();
    eventHub.connect(asking as unknown as WebSocket);
    eventHub.connect(other as unknown as WebSocket);
    asking.say({ type: "ping" });
    await settle();
    expect(asking.sent.filter((message) => message.type === "pong")).toHaveLength(1);
    expect(other.sent.filter((message) => message.type === "pong")).toHaveLength(0);
  });

  it("tells a page closed on purpose apart from one whose connection dropped", async () => {
    const eventHub = hub();
    const departures: boolean[] = [];
    eventHub.onPageCountChange = (count, lastPageLeftOnPurpose) => {
      if (count === 0) departures.push(lastPageLeftOnPurpose);
    };
    const closed = new FakePage();
    eventHub.connect(closed as unknown as WebSocket);
    closed.say({ type: "page_closing" });
    await settle();
    closed.emit("close");
    const dropped = new FakePage();
    eventHub.connect(dropped as unknown as WebSocket);
    dropped.emit("close");
    expect(departures).toEqual([true, false]);
  });
});
