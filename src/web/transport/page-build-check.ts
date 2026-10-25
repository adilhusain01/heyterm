// Spots a page and a server from different builds once per server build: reloads a stale page
// once, or says to restart HeyTerm when the server is the older one. Rules in page-build.ts.

import { toast } from "sonner";
import { PageBuild } from "../../shared/page-build.ts";

const reloadedForKey = "heyterm.reloadedForBuild";
let checkedServerEntry: string | undefined;

export async function checkPageBuild(serverEntry: string | undefined): Promise<void> {
  if (!serverEntry || serverEntry === checkedServerEntry) return;
  checkedServerEntry = serverEntry;
  const pageEntry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src.split("/").pop();
  if (PageBuild.verdict({ pageEntry, serverEntry }) === "same") return;
  const indexHtml = await fetch("/", { cache: "no-store" }).then((response) => response.text(), () => "");
  const verdict = PageBuild.verdict({ pageEntry, serverEntry, entryOnDisk: PageBuild.entryFromIndexHtml(indexHtml) });
  if (verdict === "reload_page") {
    // Once per server build, so a page that cannot catch up never reloads in a loop.
    if (readReloadedFor() === serverEntry) return;
    writeReloadedFor(serverEntry);
    window.location.reload();
  }
  if (verdict === "restart_server") toast.warning("HeyTerm was updated while it ran. Restart it (heyterm stop, then heyterm) to use the new version.", { duration: Infinity });
}

function readReloadedFor(): string | undefined {
  try {
    return sessionStorage.getItem(reloadedForKey) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeReloadedFor(serverEntry: string): void {
  try {
    sessionStorage.setItem(reloadedForKey, serverEntry);
  } catch {
    // Without storage the page may reload again on the next snapshot; that is all.
  }
}
