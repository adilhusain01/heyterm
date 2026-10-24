// Tells which attention items are new since the last look, so each one is announced once.

import type { AttentionItem } from "./types.ts";

export class AttentionArrivals {
  private knownKeys: Set<string> | undefined;

  note(queue: AttentionItem[]): AttentionItem[] {
    const keys = new Set(queue.map(itemKey));
    const previous = this.knownKeys;
    this.knownKeys = keys;
    // The first queue after loading is what was already there, not news.
    if (!previous) return [];
    return queue.filter((item) => !previous.has(itemKey(item)));
  }
}

function itemKey(item: AttentionItem): string {
  return `${item.sessionName}|${item.kind}|${item.since}`;
}
