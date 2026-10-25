// Says what needs you, at a moment you can hear it: one line after another, never over your own
// dictation, through the Mac's voice or the browser's.

import { AnnouncementText, AttentionQueue } from "../../shared/attention.ts";
import { Earcons } from "./earcons.ts";
import { SpeechQueue, type SpeechPlayer } from "./speech-queue.ts";
import type { Voice } from "./voice-choice.ts";
import type { Feedback } from "../../shared/protocol.ts";
import type { AnnouncementMode, AttentionItem, SessionView } from "../../shared/types.ts";

// Arrivals within this window are spoken together (only where the page narrates itself).
const groupingMilliseconds = 1_200;
// Nothing is spoken until the command bar has been quiet this long.
const quietAfterInputMilliseconds = 1_500;
const tickMilliseconds = 150;

// Speaks through the server with the Mac's own voice; the server says when each line is done.
export interface MacSpeaker {
  speak(text: string, id: number): void;
  stop(): void;
}

export class Announcer {
  readonly earcons = new Earcons();
  private modeValue: AnnouncementMode = "speak";
  private knownItemKeys: Set<string> | undefined;
  private waitingItems: AttentionItem[] = [];
  private groupTimer: number | undefined;
  // Without a server that narrates (the playground), the page puts arrivals into words itself.
  speaksArrivalsItself = false;
  private voice: Voice = "browser";
  private macSpeaker: MacSpeaker | undefined;
  private nextMacLineId = 1;
  private readonly macLinesWaiting = new Map<number, () => void>();
  private readonly queue: SpeechQueue;
  // Tells the page when HeyTerm starts and stops talking, for the assistant orb.
  onSpeakingChange: (speaking: boolean) => void = () => undefined;

  constructor() {
    const player: SpeechPlayer = {
      play: (text, done) => (this.voice === "mac" && this.macSpeaker ? this.playOnMac(text, done) : playInBrowser(text, done)),
      stop: () => {
        window.speechSynthesis?.cancel();
        this.macSpeaker?.stop();
        this.macLinesWaiting.clear();
      },
    };
    this.queue = new SpeechQueue(player, { quietAfterInputMilliseconds });
    this.queue.onSpeakingChange = (speaking) => this.onSpeakingChange(speaking);
    window.setInterval(() => this.queue.tick(Date.now()), tickMilliseconds);
  }

  get mode(): AnnouncementMode {
    return this.modeValue;
  }

  set mode(mode: AnnouncementMode) {
    if (mode === "mute" && this.modeValue !== "mute") this.queue.clear();
    this.modeValue = mode;
  }

  useVoice(voice: Voice, macSpeaker: MacSpeaker | undefined): void {
    if (voice !== this.voice) this.queue.clear();
    this.voice = voice;
    this.macSpeaker = macSpeaker;
  }

  // The server finished saying one of this page's lines.
  noteMacLineDone(id: number): void {
    const done = this.macLinesWaiting.get(id);
    this.macLinesWaiting.delete(id);
    done?.();
  }

  // Compares the new queue with the last one, plays a sound for what is new, and says it when the
  // page narrates by itself.
  noteSessions(sessions: SessionView[]): AttentionItem[] {
    const queue = AttentionQueue.build(sessions);
    const keys = new Set(queue.map(itemKey));
    const previous = this.knownItemKeys;
    this.knownItemKeys = keys;
    // The first snapshot after loading is what was already there, not news.
    if (!previous) return [];
    const arrived = queue.filter((item) => !previous.has(itemKey(item)));
    if (arrived.length > 0) this.noteArrivals(arrived);
    return arrived;
  }

  // A line from the assistant; said in turn, once the user has stopped dictating.
  sayWhenQuiet(text: string): void {
    if (this.modeValue === "mute") return;
    this.queue.enqueue(text, Date.now());
  }

  noteFeedback(feedback: Feedback): void {
    if (feedback.tone === "error") this.earcons.play("error");
    else if (feedback.tone === "success") this.earcons.play("sent");
    if (feedback.speak) this.sayWhenQuiet(feedback.text);
  }

  // Called on every change in the command bar: the user may be dictating right now.
  noteInputActivity(): void {
    this.queue.noteInput(Date.now());
  }

  // The voice test: whatever was waiting is dropped so the test is heard at once.
  speakNow(text: string): void {
    this.queue.clear();
    this.queue.enqueue(text, Date.now());
  }

  unlock(): void {
    this.earcons.unlock();
  }

  private noteArrivals(items: AttentionItem[]): void {
    for (const item of items) this.earcons.play(item.kind);
    if (!this.speaksArrivalsItself) return;
    this.waitingItems.push(...items);
    window.clearTimeout(this.groupTimer);
    this.groupTimer = window.setTimeout(() => {
      const text = AnnouncementText.forItems(this.waitingItems, this.modeValue);
      this.waitingItems = [];
      if (text) this.sayWhenQuiet(text);
    }, groupingMilliseconds);
  }

  private playOnMac(text: string, done: () => void): void {
    const id = this.nextMacLineId++;
    this.macLinesWaiting.set(id, done);
    this.macSpeaker!.speak(text, id);
  }
}

function playInBrowser(text: string, done: () => void): void {
  const synthesis = window.speechSynthesis;
  if (!synthesis) return done();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.08;
  const voice = preferredVoice(synthesis.getVoices());
  if (voice) utterance.voice = voice;
  utterance.onend = () => done();
  utterance.onerror = () => done();
  synthesis.speak(utterance);
}

function itemKey(item: AttentionItem): string {
  return `${item.sessionName}|${item.kind}|${item.since}`;
}

// A clear English voice when the system has one; the browser default otherwise.
function preferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const english = voices.filter((voice) => voice.lang.startsWith("en"));
  return english.find((voice) => /Samantha|Ava|Daniel|Google US English/.test(voice.name)) ?? english.find((voice) => voice.localService) ?? english[0];
}
