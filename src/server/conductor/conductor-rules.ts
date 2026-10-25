// Small decisions around the assistant: what it is asked at all, what of its reply is said out
// loud, and which of its own commands wait for a spoken "confirm".

import type { AttentionItem, RouterAction } from "../../shared/types.ts";

// Longer than this out loud, and only the first two sentences are said.
const longestSpokenReply = 280;

// These need words a model would add nothing to, or explain things in its own words when asked.
const actionsForTheAssistant: RouterAction["type"][] = ["catch_up", "status"];

export class ConductorRouting {
  static handledInstantly(action: RouterAction, { confirmationWaiting }: { confirmationWaiting: boolean }): boolean {
    // A confirm with nothing waiting in HeyTerm answers something the assistant asked.
    if (action.type === "confirm" && !confirmationWaiting) return false;
    return !actionsForTheAssistant.includes(action.type);
  }
}

export class SpokenReply {
  // The assistant writes what it says first; anything after a line of "---" is only shown.
  static from(reply: string): { spoken: string; shown: string } {
    const [spokenPart = "", ...shownParts] = reply.split(/\n\s*---\s*\n/);
    const shown = [spokenPart.trim(), ...shownParts.map((part) => part.trim())].filter(Boolean).join("\n\n");
    return { spoken: shortenedForSpeech(speakable(spokenPart)), shown };
  }
}

export class NarrationRules {
  // What still needs the user by the time the assistant has put it into words.
  static stillWaiting(told: AttentionItem[], currentQueue: AttentionItem[]): AttentionItem[] {
    const current = new Set(currentQueue.map(itemKey));
    return told.filter((item) => current.has(itemKey(item)));
  }
}

function itemKey(item: AttentionItem): string {
  return `${item.sessionName}|${item.kind}|${item.since}`;
}

function shortenedForSpeech(text: string): string {
  if (text.length <= longestSpokenReply) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return `${sentences.slice(0, 2).join("").trim()} The rest is on screen.`;
}

export class ConductorSafety {
  // The developer's standing rule: nothing reads, lists or changes their PrivateKeys folder.
  static touchesPrivateKeys(_toolName: string, input: Record<string, unknown>): boolean {
    return /privatekeys/i.test(JSON.stringify(input ?? {}));
  }

}

function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_#>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
