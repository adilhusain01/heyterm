// What counts as something said. Speech is short; a pasted file sent to the assistant would cost a
// lot for nothing, so it is refused with a reason.

const longestUtteranceCharacters = 4_000;

export type UtteranceCheck = { ok: true; utterance: string } | { ok: false; reason: "empty" | "too_long" };

export class UtteranceLimits {
  static check(text: string): UtteranceCheck {
    const utterance = text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
    if (!utterance) return { ok: false, reason: "empty" };
    if (utterance.length > longestUtteranceCharacters) return { ok: false, reason: "too_long" };
    return { ok: true, utterance };
  }
}
