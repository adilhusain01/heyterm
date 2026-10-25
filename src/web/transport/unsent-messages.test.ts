import { describe, expect, it } from "vitest";
import { UnsentMessages } from "./unsent-messages.ts";

describe("UnsentMessages", () => {
  it("sends what was said or clicked during a short drop, in order", () => {
    const unsent = new UnsentMessages();
    unsent.add("first", 1_000);
    unsent.add("second", 2_000);
    expect(unsent.takeFresh(5_000)).toEqual({ fresh: ["first", "second"], droppedCount: 0 });
    expect(unsent.takeFresh(5_000)).toEqual({ fresh: [], droppedCount: 0 });
  });

  // A dictated sentence or an approve from minutes ago must not land when HeyTerm comes back.
  it("drops what waited longer than ten seconds", () => {
    const unsent = new UnsentMessages();
    unsent.add("old", 1_000);
    unsent.add("recent", 9_000);
    expect(unsent.takeFresh(12_000)).toEqual({ fresh: ["recent"], droppedCount: 1 });
  });
});
