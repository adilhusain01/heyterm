// Short sounds, one per kind of event, so you know what happened before a word is spoken.

import type { AttentionKind } from "../../shared/types.ts";

type Tone = { frequency: number; startOffset: number; duration: number };

const tonesByKind: Record<AttentionKind | "sent" | "error", Tone[]> = {
  // Two rising notes: something is waiting on a decision.
  permission: [
    { frequency: 660, startOffset: 0, duration: 0.09 },
    { frequency: 880, startOffset: 0.11, duration: 0.12 },
  ],
  question: [
    { frequency: 587, startOffset: 0, duration: 0.09 },
    { frequency: 784, startOffset: 0.11, duration: 0.12 },
  ],
  trust: [
    { frequency: 660, startOffset: 0, duration: 0.09 },
    { frequency: 880, startOffset: 0.11, duration: 0.12 },
  ],
  // Falling notes: something went wrong.
  failed: [
    { frequency: 440, startOffset: 0, duration: 0.12 },
    { frequency: 330, startOffset: 0.14, duration: 0.16 },
  ],
  error: [{ frequency: 330, startOffset: 0, duration: 0.16 }],
  // One soft note: work is done.
  finished: [{ frequency: 784, startOffset: 0, duration: 0.14 }],
  sent: [{ frequency: 988, startOffset: 0, duration: 0.05 }],
};

export class Earcons {
  private context: AudioContext | undefined;

  // Browsers allow sound only after a click or key press on the page; call this from one.
  unlock(): void {
    this.context ??= new AudioContext();
    void this.context.resume();
  }

  get isUnlocked(): boolean {
    return this.context?.state === "running";
  }

  play(kind: keyof typeof tonesByKind): void {
    const context = this.context;
    if (!context || context.state !== "running") return;
    for (const tone of tonesByKind[kind]) this.playTone(context, tone);
  }

  private playTone(context: AudioContext, tone: Tone): void {
    const start = context.currentTime + tone.startOffset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = tone.frequency;
    // A quick attack and an exponential tail keep the note from clicking.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + tone.duration + 0.02);
  }
}
