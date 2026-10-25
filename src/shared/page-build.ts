// Whether the open page and the running server came from one build. The server names the page
// script its index.html loaded when it started; the page knows the script it runs. Pure.

export type PageBuildVerdict = "same" | "reload_page" | "restart_server";

export class PageBuild {
  static entryFromIndexHtml(html: string): string | undefined {
    return /<script[^>]*type="module"[^>]*src="\/assets\/([^"]+\.js)"/.exec(html)?.[1];
  }

  static verdict({ pageEntry, serverEntry, entryOnDisk }: { pageEntry?: string; serverEntry?: string; entryOnDisk?: string }): PageBuildVerdict {
    // A development page or a server with no built page has nothing to compare.
    if (!pageEntry || !serverEntry || pageEntry === serverEntry) return "same";
    // Newer files than the server: a reload would load the new page against the old server again.
    if (entryOnDisk && entryOnDisk !== serverEntry) return "restart_server";
    return "reload_page";
  }
}
