import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BundleWatch } from "./bundle-watch.ts";

const watches: BundleWatch[] = [];
afterEach(() => watches.splice(0).forEach((watch) => watch.stop()));

async function waitFor(check: () => boolean, milliseconds = 5_000): Promise<void> {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline && !check()) await new Promise((resolve) => setTimeout(resolve, 50));
}

function bundleFile(text: string): string {
  const filePath = path.join(mkdtempSync(path.join(os.tmpdir(), "heyterm-bundle-")), "cli.js");
  writeFileSync(filePath, text);
  return filePath;
}

describe("BundleWatch", () => {
  it("says when the server's code changes on disk, once the writing has settled", async () => {
    const filePath = bundleFile("console.log(1)");
    let changes = 0;
    const watch = new BundleWatch(filePath, () => (changes += 1), 200);
    watches.push(watch);
    watch.start();
    writeFileSync(filePath, "console.log(2");
    writeFileSync(filePath, "console.log(2)");
    await waitFor(() => changes > 0);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(changes).toBe(1);
  });

  // npm run build writes the server bundle again even when only the page changed.
  it("stays quiet when the file is written again with the same code", async () => {
    const filePath = bundleFile("console.log(1)");
    let changes = 0;
    const watch = new BundleWatch(filePath, () => (changes += 1), 100);
    watches.push(watch);
    watch.start();
    writeFileSync(filePath, "console.log(1)");
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(changes).toBe(0);
  });
});
