import { describe, expect, it } from "vitest";
import { SessionIdentity } from "./session-identity.ts";

describe("SessionIdentity.initials", () => {
  it("takes the first letter of a one-word name", () => {
    expect(SessionIdentity.initials("portfolio")).toBe("P");
  });

  it("takes the first letter of each part of a name with dashes or spaces", () => {
    expect(SessionIdentity.initials("docs-site")).toBe("DS");
    expect(SessionIdentity.initials("my big app")).toBe("MB");
  });

  it("keeps a number that tells two sessions of one project apart", () => {
    expect(SessionIdentity.initials("web-2")).toBe("W2");
  });
});

describe("SessionIdentity.hue", () => {
  it("gives a session the same colour every time", () => {
    expect(SessionIdentity.hue("portfolio")).toBe(SessionIdentity.hue("portfolio"));
  });

  it("gives different sessions different colours", () => {
    const hues = new Set(["web", "api", "billing", "mobile", "docs", "portfolio"].map(SessionIdentity.hue));
    expect(hues.size).toBe(6);
  });
});

describe("SessionIdentity.promptPreview", () => {
  it("drops system blocks and image markers that are not what the person said", () => {
    expect(SessionIdentity.promptPreview("[Image #17] is leftbar the right place?")).toBe("is leftbar the right place?");
    expect(SessionIdentity.promptPreview("<task-notification><task-id>b1</task-id>done</task-notification> fix the header")).toBe("fix the header");
  });

  it("shows nothing when nothing said is left", () => {
    expect(SessionIdentity.promptPreview("<task-notification><task-id>b1</task-id></task-notification>")).toBe("");
  });

  it("keeps the first line only", () => {
    expect(SessionIdentity.promptPreview("fix the header\nand the footer")).toBe("fix the header");
  });
});
