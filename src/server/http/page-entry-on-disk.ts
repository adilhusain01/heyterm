// The page build on disk now. The server serves the page files straight from disk, so after a
// page-only build a reload is all an open page needs; naming the build it started with made the
// page ask for a restart instead. Read on each snapshot; the file is read again only when it changed.
// A write in the same clock tick as the last read keeps the same modified time (Windows CI showed
// this), so a read of a file that young is not trusted, as git does for "racily clean" files.

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PageBuild } from "../../shared/page-build.ts";

// Younger than this when read, the file might still change without its modified time moving.
const settledMilliseconds = 2_000;

export class PageEntryOnDisk {
  private readMtime = -1;
  private isReadSettled = false;
  private entry: string | undefined;

  constructor(private readonly webDirectory: string) {}

  current(): string | undefined {
    const indexPath = path.join(this.webDirectory, "index.html");
    let modified: number;
    try {
      modified = statSync(indexPath).mtimeMs;
    } catch {
      return undefined;
    }
    if (modified !== this.readMtime || !this.isReadSettled) {
      try {
        this.entry = PageBuild.entryFromIndexHtml(readFileSync(indexPath, "utf8"));
      } catch {
        this.entry = undefined;
      }
      this.readMtime = modified;
      this.isReadSettled = Date.now() - modified > settledMilliseconds;
    }
    return this.entry;
  }
}
