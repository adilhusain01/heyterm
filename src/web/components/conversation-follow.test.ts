import { describe, expect, it } from "vitest";
import { ConversationFollow } from "./conversation-follow.ts";

describe("ConversationFollow.isAtEnd", () => {
  it("counts the list as read to the bottom within 120 pixels of the end", () => {
    expect(ConversationFollow.isAtEnd({ scrollHeight: 2000, scrollTop: 1500, clientHeight: 500 })).toBe(true);
    expect(ConversationFollow.isAtEnd({ scrollHeight: 2000, scrollTop: 1400, clientHeight: 500 })).toBe(true);
    expect(ConversationFollow.isAtEnd({ scrollHeight: 2000, scrollTop: 1300, clientHeight: 500 })).toBe(false);
  });
});

describe("ConversationFollow.newRequests", () => {
  // Seen on 25 October 2026: a permission card arrived and stayed out of view, 167 pixels below.
  it("names the requests that were not there before, so each is brought into view once", () => {
    expect(ConversationFollow.newRequests(["api-permission-1"], ["api-permission-1", "web-question-2"])).toEqual(["web-question-2"]);
    expect(ConversationFollow.newRequests(["api-permission-1"], ["api-permission-1"])).toEqual([]);
    expect(ConversationFollow.newRequests(["api-permission-1"], [])).toEqual([]);
  });
});
