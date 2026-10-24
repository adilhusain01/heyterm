// Short spoken forms of what an agent wrote.

const longestSpokenSentence = 160;

export function firstSentence(message: string): string {
  const firstParagraph = plainText(message).split(/\n\s*\n/)[0] ?? "";
  const sentence = splitSentences(firstParagraph)[0] ?? "";
  // A sentence that introduces a list or code reads as finished when spoken.
  return shorten(sentence.replace(/:$/, "."));
}

export function lastQuestionSentence(message: string): string {
  const paragraphs = plainText(message).split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
  const lastParagraph = paragraphs.at(-1) ?? "";
  const questions = splitSentences(lastParagraph).filter((sentence) => sentence.includes("?"));
  return shorten(questions.at(-1) ?? lastParagraph);
}

function plainText(message: string): string {
  return message
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .trim();
}

function splitSentences(paragraph: string): string[] {
  return paragraph
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function shorten(sentence: string): string {
  if (sentence.length <= longestSpokenSentence) return sentence;
  return `${sentence.slice(0, longestSpokenSentence).replace(/\s+\S*$/, "")}…`;
}
