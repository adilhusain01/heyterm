// Matches names as Wispr writes them ("book boy", "synced") to session and project names.

import { wordSpans } from "./utterance-text.ts";

export interface NameMention {
  name: string;
  score: number;
  firstWordIndex: number;
  lastWordIndex: number;
}

interface NameCandidate {
  name: string;
  compact: string;
}

export class SpokenNameMatcher {
  static readonly minimumScore = 0.8;
  // A name is at most this many spoken words ("synq ai website" is three).
  static readonly longestNameInWords = 4;

  private readonly candidates: NameCandidate[];

  constructor(names: string[]) {
    this.candidates = names.map((name) => ({ name, compact: compactForm(name) }));
  }

  findBest(phrase: string): { name: string; score: number } | undefined {
    const compactPhrase = compactForm(phrase);
    let best: { name: string; score: number } | undefined;
    for (const candidate of this.candidates) {
      const score = similarityScore(compactPhrase, candidate.compact);
      if (score >= SpokenNameMatcher.minimumScore && (!best || score > best.score)) {
        best = { name: candidate.name, score };
      }
    }
    return best;
  }

  findMentions(utterance: string): NameMention[] {
    const words = wordSpans(utterance).map((span) => span.word);
    const possibleMentions = this.allWindowMatches(words);
    // Best and longest first, then keep the ones that do not overlap.
    possibleMentions.sort((left, right) => right.score - left.score || spanLength(right) - spanLength(left));
    const chosen: NameMention[] = [];
    for (const mention of possibleMentions) {
      const overlaps = chosen.some((kept) => mention.firstWordIndex <= kept.lastWordIndex && kept.firstWordIndex <= mention.lastWordIndex);
      if (!overlaps) chosen.push(mention);
    }
    return chosen.sort((left, right) => left.firstWordIndex - right.firstWordIndex);
  }

  private allWindowMatches(words: string[]): NameMention[] {
    const mentions: NameMention[] = [];
    for (let firstWordIndex = 0; firstWordIndex < words.length; firstWordIndex += 1) {
      for (let windowSize = 1; windowSize <= SpokenNameMatcher.longestNameInWords; windowSize += 1) {
        const lastWordIndex = firstWordIndex + windowSize - 1;
        if (lastWordIndex >= words.length) break;
        const phrase = words.slice(firstWordIndex, lastWordIndex + 1).join(" ");
        const best = this.findBest(phrase);
        if (best) mentions.push({ ...best, firstWordIndex, lastWordIndex });
      }
    }
    return mentions;
  }
}

function compactForm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function spanLength(mention: NameMention): number {
  return mention.lastWordIndex - mention.firstWordIndex;
}

function similarityScore(spoken: string, candidate: string): number {
  if (spoken.length < 3 || candidate.length < 3) return 0;
  if (spoken === candidate) return 1;
  // Short names only match exactly: "peek" must not become "peeker".
  if (spoken.length < 5 || candidate.length < 5) return 0;
  const longest = Math.max(spoken.length, candidate.length);
  return 1 - editDistance(spoken, candidate) / longest;
}

// Damerau-Levenshtein distance (optimal string alignment), so a swapped pair counts once.
function editDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));
  for (let row = 0; row < rows; row += 1) distances[row]![0] = row;
  for (let column = 0; column < columns; column += 1) distances[0]![column] = column;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      let distance = Math.min(
        distances[row - 1]![column]! + 1,
        distances[row]![column - 1]! + 1,
        distances[row - 1]![column - 1]! + substitutionCost,
      );
      const isSwap = row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1];
      if (isSwap) distance = Math.min(distance, distances[row - 2]![column - 2]! + 1);
      distances[row]![column] = distance;
    }
  }
  return distances[rows - 1]![columns - 1]!;
}
