// Counts today's actions by how they were made, for the hands-off meter. Kept per browser.

export type ActionSource = "voice" | "keyboard" | "pointer";

interface SavedTally {
  day: string;
  voice: number;
  keyboard: number;
  pointer: number;
}

const storageKey = "heyterm.handsOff";

export class HandsOffTally {
  constructor(
    readonly day: string,
    readonly voice: number,
    readonly keyboard: number,
    readonly pointer: number,
  ) {}

  static loadToday(): HandsOffTally {
    const today = new Date().toDateString();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as SavedTally | null;
      if (saved?.day === today) return new HandsOffTally(today, saved.voice, saved.keyboard, saved.pointer);
    } catch {
      // Storage can be blocked; the meter then starts from zero.
    }
    return new HandsOffTally(today, 0, 0, 0);
  }

  get total(): number {
    return this.voice + this.keyboard + this.pointer;
  }

  // Share of actions made by voice, or undefined before the first action.
  get voiceShare(): number | undefined {
    return this.total === 0 ? undefined : this.voice / this.total;
  }

  withAction(source: ActionSource): HandsOffTally {
    const current = this.day === new Date().toDateString() ? this : new HandsOffTally(new Date().toDateString(), 0, 0, 0);
    const next = new HandsOffTally(
      current.day,
      current.voice + (source === "voice" ? 1 : 0),
      current.keyboard + (source === "keyboard" ? 1 : 0),
      current.pointer + (source === "pointer" ? 1 : 0),
    );
    try {
      localStorage.setItem(storageKey, JSON.stringify({ day: next.day, voice: next.voice, keyboard: next.keyboard, pointer: next.pointer }));
    } catch {
      // Not saving is fine; the count still shows for this visit.
    }
    return next;
  }
}
