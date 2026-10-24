// Speaks through macOS `say`, which uses the voice chosen in System Settings > Accessibility >
// Spoken Content. Siri voices work here; web pages are not allowed to use them. One line at a
// time: the page sends the next line when this one is done.

import { spawn, type ChildProcess } from "node:child_process";

// Two open pages send the same line at nearly the same moment; it is said once.
const duplicateWindowMilliseconds = 3_000;

export class MacVoice {
  readonly available = process.platform === "darwin";
  private speaking: { child: ChildProcess; done: () => void } | undefined;
  private readonly deduplicator = new SpokenLineDeduplicator(duplicateWindowMilliseconds);

  speak(text: string, done: () => void): void {
    if (!this.available || !text.trim() || !this.deduplicator.shouldSpeak(text, Date.now())) return done();
    this.stop();
    // The text goes in on stdin, so nothing in it can be read as an option or a shell word.
    const child = spawn("say", ["-f", "-"], { stdio: ["pipe", "ignore", "ignore"] });
    const line = { child, done };
    child.on("error", () => this.finish(line));
    child.on("exit", () => this.finish(line));
    child.stdin.on("error", () => undefined);
    child.stdin.end(text);
    this.speaking = line;
  }

  stop(): void {
    const line = this.speaking;
    this.speaking = undefined;
    line?.child.kill();
    line?.done();
  }

  private finish(line: { child: ChildProcess; done: () => void }): void {
    if (this.speaking !== line) return;
    this.speaking = undefined;
    line.done();
  }
}

export class SpokenLineDeduplicator {
  private readonly lastSaidAt = new Map<string, number>();

  constructor(private readonly windowMilliseconds: number) {}

  shouldSpeak(text: string, now: number): boolean {
    const key = text.trim();
    const last = this.lastSaidAt.get(key);
    for (const [line, at] of this.lastSaidAt) if (now - at > this.windowMilliseconds) this.lastSaidAt.delete(line);
    if (last !== undefined && now - last <= this.windowMilliseconds) return false;
    this.lastSaidAt.set(key, now);
    return true;
  }
}
