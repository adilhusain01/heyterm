// The secret that lets this page talk to HeyTerm. The heyterm command opens the page with a
// one-time ticket (#ticket=...), which the page trades for the token and keeps in this browser.
// Nothing secret stays in the address bar.

const storageKey = "heyterm.token";

let cachedToken: string | undefined;
let pairing: Promise<string | undefined> | undefined;

export function pageToken(): string | undefined {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = localStorage.getItem(storageKey) ?? undefined;
  } catch {
    cachedToken = undefined;
  }
  return cachedToken;
}

// Trades a ticket in the address for the token, once, then cleans the address.
export function ensurePageToken(): Promise<string | undefined> {
  pairing ??= (async () => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const ticket = parameters.get("ticket");
    const tokenInAddress = parameters.get("token");
    if (ticket || tokenInAddress) history.replaceState(null, "", window.location.pathname + window.location.search);
    if (tokenInAddress) remember(tokenInAddress);
    if (ticket) {
      const response = await fetch("/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket }) }).catch(() => undefined);
      const body = response?.ok ? ((await response.json().catch(() => ({}))) as { token?: string }) : {};
      if (body.token) remember(body.token);
    }
    return pageToken();
  })();
  return pairing;
}

function remember(token: string): void {
  cachedToken = token;
  try {
    localStorage.setItem(storageKey, token);
  } catch {
    // Without storage the token still works for this visit.
  }
}
