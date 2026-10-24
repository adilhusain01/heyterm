// The playground's backend: the same interface as the real server, answered by PlaygroundWorld.

import { PlaygroundWorld } from "./playground-world.ts";
import type { CallsignConnection, ConnectionHandlers, TerminalChannel } from "../transport/connection.ts";
import type { ClientMessage } from "../../shared/protocol.ts";

export class SimulatedConnection implements CallsignConnection {
  private readonly world = new PlaygroundWorld();
  private started = false;

  connect(handlers: ConnectionHandlers): () => void {
    handlers.onStatus("open");
    // React's development mode connects twice; the world plays its script once.
    if (!this.started) {
      this.started = true;
      this.world.start((message) => handlers.onMessage(message));
    }
    return () => undefined;
  }

  send(message: ClientMessage): void {
    this.world.receive(message);
  }

  openTerminal(sessionName: string): TerminalChannel {
    const closeListeners: Array<() => void> = [];
    let unsubscribe: () => void = () => undefined;
    return {
      onData: (listener) => {
        unsubscribe = this.world.terminals.subscribe(sessionName, listener);
      },
      onClose: (listener) => closeListeners.push(listener),
      // Typing into a simulated terminal does nothing; voice is the point here.
      write: () => undefined,
      resize: () => undefined,
      close: () => unsubscribe(),
    };
  }
}
