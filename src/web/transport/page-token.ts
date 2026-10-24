// The secret that lets this page talk to Callsign. The callsign command opens the page with it in
// the address (#token=...); it is kept in this browser and taken out of the address bar at once.

const storageKey = "callsign.token";

export function pageToken(): string | undefined {
  const fromAddress = new URLSearchParams(window.location.hash.slice(1)).get("token");
  if (fromAddress) {
    try {
      localStorage.setItem(storageKey, fromAddress);
    } catch {
      // Without storage the token still works for this visit.
    }
    history.replaceState(null, "", window.location.pathname + window.location.search);
    cachedToken = fromAddress;
  }
  if (cachedToken) return cachedToken;
  try {
    cachedToken = localStorage.getItem(storageKey) ?? undefined;
  } catch {
    cachedToken = undefined;
  }
  return cachedToken;
}

let cachedToken: string | undefined;
