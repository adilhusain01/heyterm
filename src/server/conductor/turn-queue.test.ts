import { describe, expect, it } from "vitest";
import { TurnQueue } from "./turn-queue.ts";

describe("TurnQueue", () => {
  it("takes what the user said ahead of announcements still waiting", () => {
    const queue = new TurnQueue<string>();
    queue.add("event one", "event");
    queue.add("event two", "event");
    queue.add("user", "user");
    expect([queue.next(), queue.next(), queue.next()]).toEqual(["user", "event one", "event two"]);
  });

  it("keeps the user's own turns in the order they were said", () => {
    const queue = new TurnQueue<string>();
    queue.add("event", "event");
    queue.add("first", "user");
    queue.add("second", "user");
    expect([queue.next(), queue.next(), queue.next()]).toEqual(["first", "second", "event"]);
  });

  it("is empty when nothing waits", () => {
    expect(new TurnQueue<string>().next()).toBeUndefined();
  });
});
