import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PageEntryOnDisk } from "./page-entry-on-disk.ts";

const page = (entry: string) => `<script type="module" crossorigin src="/assets/${entry}"></script>`;

describe("PageEntryOnDisk", () => {
  // A page-only build used to bring up "HeyTerm was updated while it ran. Restart it", though the
  // server serves the page files from disk and a reload was all it needed (26 October 2026).
  it("names the page build that is on disk now, not the one the server started with", async () => {
    const folder = mkdtempSync(path.join(os.tmpdir(), "heyterm-web-"));
    writeFileSync(path.join(folder, "index.html"), page("index-old.js"));
    const entry = new PageEntryOnDisk(folder);
    expect(await entry.current()).toBe("index-old.js");
    writeFileSync(path.join(folder, "index.html"), page("index-new.js"));
    expect(await entry.current()).toBe("index-new.js");
  });

  // Windows CI, 28 October 2026: a build written in the same clock tick as the last read kept the
  // same modified time, and the old build was still named.
  it("names a build written in the same clock tick as the last read", () => {
    const folder = mkdtempSync(path.join(os.tmpdir(), "heyterm-web-"));
    const indexPath = path.join(folder, "index.html");
    const sameTick = new Date();
    writeFileSync(indexPath, page("index-old.js"));
    utimesSync(indexPath, sameTick, sameTick);
    const entry = new PageEntryOnDisk(folder);
    expect(entry.current()).toBe("index-old.js");
    writeFileSync(indexPath, page("index-new.js"));
    utimesSync(indexPath, sameTick, sameTick);
    expect(entry.current()).toBe("index-new.js");
  });

  it("names nothing when there is no built page", async () => {
    expect(await new PageEntryOnDisk(path.join(os.tmpdir(), "heyterm-no-such-folder")).current()).toBeUndefined();
  });
});
