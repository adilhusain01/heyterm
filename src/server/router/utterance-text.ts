// Words of an utterance with their places in the original text, and the spoken phrases the router listens for.

export interface WordSpan {
  word: string;
  start: number;
  end: number;
}

export function wordSpans(text: string): WordSpan[] {
  return [...text.matchAll(/[a-z0-9][a-z0-9'-]*/gi)].map((match) => ({
    word: match[0].toLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

// Lowercase words joined by single spaces: "Yeah, go ahead." becomes "yeah go ahead".
export function normalizedPhrase(text: string): string {
  return wordSpans(text)
    .map((span) => span.word)
    .join(" ");
}

// The original text from a word onwards, keeping the user's casing and punctuation.
export function textFromWord(text: string, spans: WordSpan[], wordIndex: number): string {
  const span = spans[wordIndex];
  return span ? text.slice(span.start).trim() : "";
}

export const SpokenPhrases = {
  yes: /^(yes|yeah|yep|yup|sure|ok|okay|approve|approved|allow|accept|fine|sounds good|looks good|go ahead|do it)( (it|that|this|please|go ahead|do it))*$/,
  confirm: /^(confirm|confirmed|i confirm|yes confirm)$/,
  no: /^(no|nope|nah|deny|reject|don't|do not)\b/,
  cancelPreview: /^(cancel|wait|no wait|hold on|scratch that|never mind|nevermind|don't send( it)?|undo|stop)$/,
  sendNow: /^(send|send it|send it now|send now|go|now)$/,
  catchUp: /^(catch me up|what did i miss|what's going on|what is going on|status|status update|update me|give me an update|what's happening|where are we)$/,
  quiet: /^(be quiet|quiet|quiet mode|focus mode|shh+|less talking)$/,
  mute: /^(mute|silence|stop talking|shut up)$/,
  speak: /^(speak|unmute|talk to me|sound on|voice on)$/,
};

// Words around a name that are not part of it: "the book boy session".
const nameFillerWords = new Set(["the", "session", "agent", "one", "terminal", "project", "tab", "window", "repo"]);

export function withoutNameFiller(words: string[]): string[] {
  let first = 0;
  let last = words.length - 1;
  while (first <= last && nameFillerWords.has(words[first]!)) first += 1;
  while (last >= first && nameFillerWords.has(words[last]!)) last -= 1;
  return words.slice(first, last + 1);
}

const ordinalWords: Record<string, number> = {
  first: 0, "1st": 0, one: 0, "1": 0,
  second: 1, "2nd": 1, two: 1, "2": 1,
  third: 2, "3rd": 2, three: 2, "3": 2,
  fourth: 3, "4th": 3, four: 3, "4": 3,
};

// "the second one", "option 2", "number three", "the last one". -1 means the last.
export function spokenOrdinal(phrase: string): number | undefined {
  const words = phrase.split(" ").filter((word) => !["the", "one", "option", "number", "choice", "please"].includes(word));
  if (words.length !== 1) return undefined;
  const [word] = words as [string];
  if (word === "last") return -1;
  return ordinalWords[word];
}
