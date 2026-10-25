// Which voice speaks: the Mac's own (any voice set in System Settings, Siri voices included,
// which browsers are not allowed to use) or the browser's.

export type Voice = "mac" | "browser";

const storageKey = "heyterm.voice";

export class VoiceChoice {
  static effective({ preference, macVoiceAvailable }: { preference: Voice | undefined; macVoiceAvailable: boolean }): Voice {
    if (!macVoiceAvailable) return "browser";
    return preference ?? "mac";
  }

  static savedPreference(): Voice | undefined {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === "mac" || saved === "browser" ? saved : undefined;
    } catch {
      return undefined;
    }
  }

  static savePreference(voice: Voice): void {
    try {
      localStorage.setItem(storageKey, voice);
    } catch {
      // Not saving only means the choice resets on the next visit.
    }
  }
}
