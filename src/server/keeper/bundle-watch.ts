// Notices when the server's code on disk changes (an update, a rebuild), so the keeper can start the
// new code while the terminals keep running. It compares the file's contents, since a build writes
// the file again even when nothing in it changed, and waits for the writing to settle.

import { createHash } from "node:crypto";
import { readFileSync, watchFile, unwatchFile } from "node:fs";

const pollMilliseconds = 500;

export class BundleWatch {
  private knownHash: string | undefined;
  private settleTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly filePath: string,
    private readonly onChange: () => void,
    private readonly settleMilliseconds = 1_500,
  ) {}

  start(): void {
    this.knownHash = this.hash();
    // Polling works the same on every system and survives the file being replaced by a build.
    watchFile(this.filePath, { interval: pollMilliseconds }, () => {
      clearTimeout(this.settleTimer);
      this.settleTimer = setTimeout(() => this.checkForChange(), this.settleMilliseconds);
    });
  }

  stop(): void {
    clearTimeout(this.settleTimer);
    unwatchFile(this.filePath);
  }

  private checkForChange(): void {
    const currentHash = this.hash();
    if (!currentHash || currentHash === this.knownHash) return;
    this.knownHash = currentHash;
    this.onChange();
  }

  private hash(): string | undefined {
    try {
      return createHash("sha256").update(readFileSync(this.filePath)).digest("hex");
    } catch {
      return undefined;
    }
  }
}
