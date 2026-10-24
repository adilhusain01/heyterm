// Watches starting sessions for the folder trust dialog, which no hook reports.

import { ScreenReader } from "./screen-reader.ts";
import { SessionLifecycle } from "./session-lifecycle.ts";
import type { SessionRegistry } from "./session-registry.ts";
import type { TmuxServer } from "../tmux/tmux-server.ts";

const pollMilliseconds = 700;

export class TrustDialogWatcher {
  private timer: NodeJS.Timeout | undefined;
  private polling = false;

  constructor(
    private readonly tmux: TmuxServer,
    private readonly registry: SessionRegistry,
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.poll(), pollMilliseconds);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      for (const session of this.registry.list()) {
        if (session.state !== "starting") continue;
        const screen = await this.tmux.captureScreen(session.name);
        if (ScreenReader.trustDialogKeys(screen)) {
          this.registry.update(session.name, (current) => SessionLifecycle.applyTrustDialog(current, Date.now()));
        }
      }
    } finally {
      this.polling = false;
    }
  }
}
