import { describe, expect, it } from "vitest";
import { SpokenNameMatcher } from "./spoken-name-matcher.ts";

const sessionNames = ["synqed", "peeker", "bookboy", "layoutgen", "whisker", "synq-ai-website"];

describe("SpokenNameMatcher.findBest", () => {
  const matcher = new SpokenNameMatcher(sessionNames);

  it("finds a name said exactly, whatever the case", () => {
    expect(matcher.findBest("Peeker")?.name).toBe("peeker");
  });

  it("finds a name Wispr split into two words", () => {
    expect(matcher.findBest("book boy")?.name).toBe("bookboy");
    expect(matcher.findBest("layout gen")?.name).toBe("layoutgen");
  });

  it("finds a name Wispr spelled the way it sounds", () => {
    expect(matcher.findBest("synced")?.name).toBe("synqed");
    expect(matcher.findBest("peaker")?.name).toBe("peeker");
  });

  it("finds a hyphenated name said with spaces", () => {
    expect(matcher.findBest("synq ai website")?.name).toBe("synq-ai-website");
  });

  it("finds nothing for a word that is not a session", () => {
    expect(matcher.findBest("database")).toBeUndefined();
    expect(matcher.findBest("it")).toBeUndefined();
  });

  it("does not match short common words to a name", () => {
    expect(matcher.findBest("peek")).toBeUndefined();
  });
});

describe("SpokenNameMatcher.findMentions", () => {
  const matcher = new SpokenNameMatcher(sessionNames);

  it("finds a name inside a sentence with its word positions", () => {
    const mentions = matcher.findMentions("tell the book boy session to use neon");
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({ name: "bookboy", firstWordIndex: 2, lastWordIndex: 3 });
  });

  it("ignores punctuation Wispr adds", () => {
    const mentions = matcher.findMentions("Peeker, run the tests again.");
    expect(mentions[0]).toMatchObject({ name: "peeker", firstWordIndex: 0 });
  });

  it("finds two different sessions in one sentence", () => {
    const names = matcher.findMentions("tell whisker to copy the tokens from synqed").map((mention) => mention.name);
    expect(names).toEqual(["whisker", "synqed"]);
  });

  it("finds no mention in a sentence about something else", () => {
    expect(matcher.findMentions("use the same colors as before")).toEqual([]);
  });
});
