// Says what needs you, at a moment you can hear it: never over your own dictation, and several
// arrivals close together become one sentence.

import { AnnouncementText, AttentionQueue } from "../../shared/attention.ts";
import { Earcons } from "./earcons.ts";
import type { Voice } from "./voice-choice.ts";
import type { Feedback } from "../../shared/protocol.ts";
import type { AnnouncementMode, AttentionItem, SessionView } from "../../shared/types.ts";

// Arrivals within this window are spoken together.
const groupingMilliseconds = 1_200;
// Nothing is spoken until the command bar has been quiet this long.
const quietAfterInputMilliseconds = 1_500;
// A rough speaking rate, to know whether the Mac may still be talking when the user starts dictating.
const macSpeechMillisecondsPerCharacter = 75;

// Speaks through the server with the Mac's own voice.
export interface MacSpeaker {
  speak(text: string): void;
  stop(): void;
}

export class Announcer {
  readonly earcons = new Earcons();
  mode: AnnouncementMode = "speak";
  private knownItemKeys: Set<string> | undefined;
  private waitingItems: AttentionItem[] = [];
  private groupTimer: number | undefined;
  private lastInputAt = 0;
  private voice: Voice = "browser";
  private macSpeaker: MacSpeaker | undefined;
  private macSpeechEndsAt = 0;

  useVoice(voice: Voice, macSpeaker: MacSpeaker | undefined): void {
    this.voice = voice;
    this.macSpeaker = macSpeaker;
  }

  // Compares the new queue with the last one and announces what is new.
  noteSessions(sessions: SessionView[]): AttentionItem[] {
    const queue = AttentionQueue.build(sessions);
    const keys = new Set(queue.map(itemKey));
    const previous = this.knownItemKeys;
    this.knownItemKeys = keys;
    // The first snapshot after loading is what was already there, not news.
    if (!previous) return [];
    const arrived = queue.filter((item) => !previous.has(itemKey(item)));
    if (arrived.length > 0) this.queueAnnouncement(arrived);
    return arrived;
  }

  noteFeedback(feedback: Feedback): void {
    if (feedback.tone === "error") this.earcons.play("error");
    else if (feedback.tone === "success") this.earcons.play("sent");
    if (feedback.speak) this.speakNow(feedback.text);
  }

  // Called on every change in the command bar: the user may be dictating right now.
  noteInputActivity(): void {
    this.lastInputAt = Date.now();
    this.stopSpeaking();
  }

  // Says a line at once, cutting off anything still being said. Used by the voice test too.
  speakNow(text: string): void {
    if (this.mode === "mute") return;
    this.stopSpeaking();
    this.speak(text);
  }

  unlock(): void {
    this.earcons.unlock();
  }

  private queueAnnouncement(items: AttentionItem[]): void {
    for (const item of items) this.earcons.play(item.kind);
    this.waitingItems.push(...items);
    window.clearTimeout(this.groupTimer);
    this.groupTimer = window.setTimeout(() => this.speakWaitingItems(), groupingMilliseconds);
  }

  private speakWaitingItems(): void {
    const sinceInput = Date.now() - this.lastInputAt;
    if (sinceInput < quietAfterInputMilliseconds) {
      this.groupTimer = window.setTimeout(() => this.speakWaitingItems(), quietAfterInputMilliseconds - sinceInput);
      return;
    }
    const text = AnnouncementText.forItems(this.waitingItems, this.mode);
    this.waitingItems = [];
    if (text) this.speak(text);
  }

  private stopSpeaking(): void {
    window.speechSynthesis?.cancel();
    if (this.macSpeaker && Date.now() < this.macSpeechEndsAt) {
      this.macSpeaker.stop();
      this.macSpeechEndsAt = 0;
    }
  }

  private speak(text: string): void {
    if (this.voice === "mac" && this.macSpeaker) {
      this.macSpeaker.speak(text);
      this.macSpeechEndsAt = Date.now() + text.length * macSpeechMillisecondsPerCharacter + 1_000;
      return;
    }
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.08;
    const voice = preferredVoice(synthesis.getVoices());
    if (voice) utterance.voice = voice;
    synthesis.speak(utterance);
  }
}

function itemKey(item: AttentionItem): string {
  return `${item.sessionName}|${item.kind}|${item.since}`;
}

// A clear English voice when the system has one; the browser default otherwise.
function preferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const english = voices.filter((voice) => voice.lang.startsWith("en"));
  return english.find((voice) => /Samantha|Ava|Daniel|Google US English/.test(voice.name)) ?? english.find((voice) => voice.localService) ?? english[0];
}
