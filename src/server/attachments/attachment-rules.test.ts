import { describe, expect, it } from "vitest";
import { AttachmentRules } from "./attachment-rules.ts";

describe("AttachmentRules.extensionFor", () => {
  it("accepts the image types Claude Code reads", () => {
    expect(AttachmentRules.extensionFor("image/png")).toBe("png");
    expect(AttachmentRules.extensionFor("image/jpeg")).toBe("jpg");
    expect(AttachmentRules.extensionFor("image/gif")).toBe("gif");
    expect(AttachmentRules.extensionFor("image/webp")).toBe("webp");
  });

  it("refuses anything that is not one of those images", () => {
    expect(AttachmentRules.extensionFor("image/svg+xml")).toBeUndefined();
    expect(AttachmentRules.extensionFor("application/pdf")).toBeUndefined();
    expect(AttachmentRules.extensionFor("")).toBeUndefined();
  });
});

describe("AttachmentRules.fileName", () => {
  it("names the file after the session and the moment, never after anything the page sent", () => {
    expect(AttachmentRules.fileName("api", "png", new Date(2026, 9, 25, 19, 5, 9), "a1b2")).toBe("api-20261025-190509-a1b2.png");
  });
});

describe("AttachmentRules.pastedText", () => {
  // Dropping an image file into a terminal types its path, and Claude Code attaches an image path it is given.
  it("is the file's path, with a space after so the next words stay apart", () => {
    expect(AttachmentRules.pastedText("/Users/adil/.heyterm/attachments/api.png")).toBe("/Users/adil/.heyterm/attachments/api.png ");
  });

  it("quotes a path with spaces, as a terminal does", () => {
    expect(AttachmentRules.pastedText("C:\\\\Users\\\\Adil Husain\\\\.heyterm\\\\attachments\\\\api.png")).toBe('"C:\\\\Users\\\\Adil Husain\\\\.heyterm\\\\attachments\\\\api.png" ');
  });
});
