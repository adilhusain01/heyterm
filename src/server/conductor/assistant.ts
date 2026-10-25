// The assistant as the rest of HeyTerm sees it: it hears what the user said, tells the user what
// happened in the sessions, and keeps the conversation the UI shows.

import { EventEmitter } from "node:events";
import { ConductorTurnText, type Situation } from "./conductor-prompt.ts";
import { NarrationRules, SpokenReply } from "./conductor-rules.ts";
import { AnnouncementText, AttentionQueue } from "../../shared/attention.ts";
import { AttentionArrivals } from "../../shared/attention-arrivals.ts";
import type { Conductor } from "./conductor.ts";
import type { ConversationEntry, ConversationEntryKind } from "../../shared/protocol.ts";
import type { AnnouncementMode, AttentionItem, SessionView } from "../../shared/types.ts";

// Arrivals this close together are told in one go.
const groupingMilliseconds = 1_200;
// If the assistant has not put an arrival into words by then, a plain line is said instead.
const narrationPatienceMilliseconds = 9_000;
const keptEntries = 80;
const kindsToldInQuietMode = ["permission", "question"];

interface AssistantEvents {
  conversation: [ConversationEntry[]];
  say: [string];
  thinking: [boolean];
}

export class Assistant extends EventEmitter<AssistantEvents> {
  private entries: ConversationEntry[] = [];
  private nextEntryId = 1;
  private readonly arrivals = new AttentionArrivals();
  private waitingArrivals: AttentionItem[] = [];
  private groupTimer: NodeJS.Timeout | undefined;
  // One announcement at a time; what arrives meanwhile is told together after it.
  private narrating = false;

  constructor(
    private readonly conductor: Conductor,
    private readonly situation: () => Promise<Situation>,
    private readonly announcementMode: () => AnnouncementMode,
  ) {
    super();
    conductor.on("activity", (kind, text) => this.record(kind, text));
    conductor.on("busy", (busy) => this.emit("thinking", busy));
  }

  // Said straight away, outside a turn: the assistant's own request for a confirm.
  sayNow(text: string): void {
    this.record("assistant", text);
    this.emit("say", text);
  }

  // Something HeyTerm did at once, without the assistant, still belongs in the conversation.
  recordInstant(utterance: string): void {
    this.record("user", utterance);
  }

  recordOutcome(text: string): void {
    this.record("event", text);
  }

  close(): void {
    clearTimeout(this.groupTimer);
    this.conductor.close();
  }

  conversation(): ConversationEntry[] {
    return this.entries;
  }

  async hear(utterance: string): Promise<void> {
    this.record("user", utterance);
    try {
      const reply = await this.conductor.ask(ConductorTurnText.forUtterance(utterance, await this.situation()), "user");
      this.tell(reply, { speak: true });
    } catch (error) {
      this.fail(error);
    }
  }

  // Called whenever sessions change; anything that newly needs the user is told once.
  noteSessions(sessions: SessionView[]): void {
    const arrived = this.arrivals.note(AttentionQueue.build(sessions));
    if (arrived.length === 0) return;
    this.waitingArrivals.push(...arrived);
    this.scheduleNarration();
  }

  private scheduleNarration(): void {
    if (this.narrating) return;
    clearTimeout(this.groupTimer);
    this.groupTimer = setTimeout(() => void this.narrateWaitingArrivals(), groupingMilliseconds);
  }

  private async narrateWaitingArrivals(): Promise<void> {
    this.narrating = true;
    try {
      await this.narrate();
    } finally {
      this.narrating = false;
      if (this.waitingArrivals.length > 0) this.scheduleNarration();
    }
  }

  private async narrate(): Promise<void> {
    const items = this.waitingArrivals;
    this.waitingArrivals = [];
    for (const item of items) this.record("event", item.headline);
    const mode = this.announcementMode();
    const told = mode === "mute" ? [] : mode === "quiet" ? items.filter((item) => kindsToldInQuietMode.includes(item.kind)) : items;
    if (told.length === 0) return;

    let saidPlainLine = false;
    const fallback = setTimeout(() => {
      void this.situation().then((situation) => {
        const stillWaiting = NarrationRules.stillWaiting(told, AttentionQueue.build(situation.sessions));
        if (stillWaiting.length === 0) return;
        saidPlainLine = true;
        const plain = AnnouncementText.forItems(stillWaiting, this.announcementMode());
        if (plain) this.emit("say", plain);
      });
    }, narrationPatienceMilliseconds);
    try {
      const reply = await this.conductor.ask(ConductorTurnText.forEvent(told, await this.situation()), "event");
      clearTimeout(fallback);
      // A late reply is still shown, but not said: the plain line was, or the user already dealt with it.
      const stillWaiting = NarrationRules.stillWaiting(told, AttentionQueue.build((await this.situation()).sessions));
      const worthSaying = stillWaiting.length > 0 || told.every((item) => item.kind === "finished" || item.kind === "failed");
      this.tell(reply, { speak: !saidPlainLine && worthSaying });
    } catch (error) {
      clearTimeout(fallback);
      if (!saidPlainLine) {
        const plain = AnnouncementText.forItems(told, mode);
        if (plain) this.emit("say", plain);
      }
      this.fail(error);
    }
  }

  private tell(reply: string, { speak }: { speak: boolean }): void {
    const { spoken, shown } = SpokenReply.from(reply);
    if (shown) this.record("assistant", shown);
    if (speak && spoken && this.announcementMode() !== "mute") this.emit("say", spoken);
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.record("error", message);
    if (this.announcementMode() !== "mute") this.emit("say", "Something went wrong on my side. It's on screen.");
  }

  private record(kind: ConversationEntryKind, text: string): void {
    this.entries = [...this.entries, { id: this.nextEntryId++, at: Date.now(), kind, text }].slice(-keptEntries);
    this.emit("conversation", this.entries);
  }
}
