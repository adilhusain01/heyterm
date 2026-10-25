import { describe, expect, it } from "vitest";
import { PageBuild } from "./page-build.ts";

describe("PageBuild.entryFromIndexHtml", () => {
  it("reads the page's main script from the built index.html", () => {
    expect(PageBuild.entryFromIndexHtml('<script type="module" crossorigin src="/assets/index-DC3QH_V-.js"></script>')).toBe("index-DC3QH_V-.js");
    expect(PageBuild.entryFromIndexHtml("<html>no build</html>")).toBeUndefined();
  });
});

describe("PageBuild.verdict", () => {
  it("is fine when the page and the server came from one build", () => {
    expect(PageBuild.verdict({ pageEntry: "index-a.js", serverEntry: "index-a.js", entryOnDisk: "index-a.js" })).toBe("same");
  });

  // HeyTerm restarted on a new version while the page stayed open.
  it("reloads a page older than the server", () => {
    expect(PageBuild.verdict({ pageEntry: "index-old.js", serverEntry: "index-new.js", entryOnDisk: "index-new.js" })).toBe("reload_page");
  });

  // The files were updated (npm update, a rebuild) while the old server kept running: reloading
  // would only load the new page against the old server again.
  it("asks for a restart when the server is older than the files", () => {
    expect(PageBuild.verdict({ pageEntry: "index-new.js", serverEntry: "index-old.js", entryOnDisk: "index-new.js" })).toBe("restart_server");
  });

  it("says nothing when it cannot tell, as in development", () => {
    expect(PageBuild.verdict({ pageEntry: undefined, serverEntry: "index-a.js", entryOnDisk: "index-a.js" })).toBe("same");
    expect(PageBuild.verdict({ pageEntry: "index-a.js", serverEntry: undefined, entryOnDisk: undefined })).toBe("same");
  });
});
