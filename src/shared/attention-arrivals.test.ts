import { describe, expect, it } from "vitest";
import { AttentionArrivals } from "./attention-arrivals.ts";
import type { AttentionItem } from "./types.ts";

const item = (sessionName: string, since: number): AttentionItem => ({ sessionName, kind: "finished", since, headline: "", spoken: "" });

describe("AttentionArrivals.note", () => {
  it("treats the first queue as what was already there, not news", () => {
    expect(new AttentionArrivals().note([item("a", 1)])).toEqual([]);
  });

  it("returns only what is new since the last queue", () => {
    const arrivals = new AttentionArrivals();
    arrivals.note([item("a", 1)]);
    expect(arrivals.note([item("a", 1), item("b", 2)])).toEqual([item("b", 2)]);
  });

  it("counts the same session needing the user again later as new", () => {
    const arrivals = new AttentionArrivals();
    arrivals.note([item("a", 1)]);
    arrivals.note([]);
    expect(arrivals.note([item("a", 5)])).toEqual([item("a", 5)]);
  });
});
