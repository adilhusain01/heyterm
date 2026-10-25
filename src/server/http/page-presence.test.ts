import { describe, expect, it } from "vitest";
import { PagePresence } from "./page-presence.ts";

describe("PagePresence.shouldStopSoon", () => {
  it("stops HeyTerm a little after the user closes the last page", () => {
    expect(PagePresence.shouldStopSoon({ openPageCount: 0, pageWasOpen: true, lastPageLeftOnPurpose: true, keepRunningWithoutPage: false })).toBe(true);
  });

  // Seen on 26 October 2026: the Mac slept, the page's connection dropped, and a page that came back
  // late would have found HeyTerm stopped and every session ended.
  it("keeps running when the last page only lost its connection", () => {
    expect(PagePresence.shouldStopSoon({ openPageCount: 0, pageWasOpen: true, lastPageLeftOnPurpose: false, keepRunningWithoutPage: false })).toBe(false);
  });

  it("keeps running while any page is open", () => {
    expect(PagePresence.shouldStopSoon({ openPageCount: 1, pageWasOpen: true, lastPageLeftOnPurpose: true, keepRunningWithoutPage: false })).toBe(false);
  });

  it("waits for a first page before anything can stop it", () => {
    expect(PagePresence.shouldStopSoon({ openPageCount: 0, pageWasOpen: false, lastPageLeftOnPurpose: true, keepRunningWithoutPage: false })).toBe(false);
  });

  it("keeps running when the user chose to keep it running without the page", () => {
    expect(PagePresence.shouldStopSoon({ openPageCount: 0, pageWasOpen: true, lastPageLeftOnPurpose: true, keepRunningWithoutPage: true })).toBe(false);
  });
});
