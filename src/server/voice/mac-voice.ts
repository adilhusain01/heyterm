// Speaks through macOS `say`, which uses the voice chosen in System Settings > Accessibility >
// Spoken Content. Siri voices work here; web pages are not allowed to use them.

import { spawn, type ChildProcess } from "node:child_process";

export class MacVoice {
  readonly available = process.platform === "darwin";
  private speaking: ChildProcess | undefined;

  speak(text: string): void {
    if (!this.available || !text.trim()) return;
    this.stop();
    // The text goes in on stdin, so nothing in it can be read as an option or a shell word.
    const child = spawn("say", ["-f", "-"], { stdio: ["pipe", "ignore", "ignore"] });
    child.on("error", () => undefined);
    child.on("exit", () => {
      if (this.speaking === child) this.speaking = undefined;
    });
    child.stdin.end(text);
    this.speaking = child;
  }

  stop(): void {
    this.speaking?.kill();
    this.speaking = undefined;
  }
}
