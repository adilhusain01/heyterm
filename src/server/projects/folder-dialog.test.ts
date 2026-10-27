import { describe, expect, it } from "vitest";
import { FolderDialog } from "./folder-dialog.ts";

describe("FolderDialog", () => {
  it("opens the system's own folder dialog on each system", () => {
    expect(FolderDialog.command("darwin")?.program).toBe("osascript");
    expect(FolderDialog.command("win32")?.program).toBe("powershell.exe");
    expect(FolderDialog.command("linux")?.program).toBe("zenity");
  });

  it("reads the chosen folder from what the dialog printed", () => {
    expect(FolderDialog.chosenPath("/Users/adil/Projects/api/\n", "darwin")).toBe("/Users/adil/Projects/api");
    expect(FolderDialog.chosenPath("C:\\Users\\adil\\api\r\n", "win32")).toBe("C:\\Users\\adil\\api");
    expect(FolderDialog.chosenPath("/", "linux")).toBe("/");
  });

  it("reads nothing when the dialog was cancelled", () => {
    expect(FolderDialog.chosenPath("", "darwin")).toBeUndefined();
    expect(FolderDialog.chosenPath("  \n", "win32")).toBeUndefined();
  });
});
