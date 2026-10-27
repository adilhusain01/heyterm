// The picker's folder search and the system folder dialog, both on the computer HeyTerm runs on.

import { pageToken } from "./page-token.ts";
import type { FolderSuggestionList } from "../../shared/protocol.ts";

export async function suggestFolders(typed: string): Promise<FolderSuggestionList | undefined> {
  const response = await fetch(`/folders?path=${encodeURIComponent(typed)}`, { headers: { "X-HeyTerm-Token": pageToken() ?? "" } }).catch(() => undefined);
  return response?.ok ? ((await response.json().catch(() => undefined)) as FolderSuggestionList | undefined) : undefined;
}

// The folder chosen, undefined when the dialog was cancelled, or an error to show.
export async function chooseFolder(): Promise<{ path?: string; error?: string }> {
  const response = await fetch("/folders/choose", { method: "POST", headers: { "X-HeyTerm-Token": pageToken() ?? "" } }).catch(() => undefined);
  if (!response) return { error: "HeyTerm is not answering. Is it still running?" };
  const body = (await response.json().catch(() => ({}))) as { path?: string; error?: string };
  if (!response.ok) return { error: body.error ?? "The folder dialog could not open." };
  return body.path ? { path: body.path } : {};
}
