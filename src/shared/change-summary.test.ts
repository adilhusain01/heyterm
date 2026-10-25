import { describe, expect, it } from "vitest";
import { ChangeSummary } from "./change-summary.ts";

describe("ChangeSummary.describe", () => {
  it("names up to three files and the lines that changed", () => {
    const summary = ChangeSummary.describe("api", ["src/checkout/totals.ts", "src/checkout/totals.test.ts"], new Map([["src/checkout/totals.ts", { added: 30, removed: 12 }], ["src/checkout/totals.test.ts", { added: 10, removed: 0 }]]));
    // Git counts against the last commit, which can include earlier tasks' work, so it says so.
    expect(summary.spoken).toBe("api changed 2 files in its last task: totals.ts and totals.test.ts. Since the last commit, 40 lines added and 12 removed.");
    expect(summary.files).toEqual(["src/checkout/totals.ts", "src/checkout/totals.test.ts"]);
  });

  it("says the folder most of the files are in when there are more than three", () => {
    const files = ["src/ui/a.tsx", "src/ui/b.tsx", "src/ui/c.tsx", "src/ui/d.tsx", "README.md"];
    expect(ChangeSummary.describe("web", files, undefined).spoken).toBe("web changed 5 files in its last task, most of them in src/ui.");
  });

  it("leaves out line counts git cannot give, as for a folder outside git", () => {
    expect(ChangeSummary.describe("docs", ["guide.md"], undefined).spoken).toBe("docs changed 1 file in its last task: guide.md.");
  });

  it("says so when the last task changed no files", () => {
    expect(ChangeSummary.describe("api", [], undefined).spoken).toBe("api has not changed any files in its last task.");
  });
});

describe("ChangeSummary.parseNumstat", () => {
  it("reads git diff --numstat, counting binary files as changed without lines", () => {
    expect(ChangeSummary.parseNumstat("30\t12\tsrc/a.ts\n-\t-\tlogo.png\n")).toEqual(new Map([["src/a.ts", { added: 30, removed: 12 }], ["logo.png", { added: 0, removed: 0 }]]));
  });
});
