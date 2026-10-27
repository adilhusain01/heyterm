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

  // Adil, 27 October 2026: a real folder dialog on Windows and Linux too.
  it("uses the newer Windows dialog when PowerShell 7 is installed", () => {
    expect(FolderDialog.command("win32", ["pwsh"])?.program).toBe("pwsh");
    expect(FolderDialog.command("win32", [])?.program).toBe("powershell.exe");
  });

  it("uses KDE's own dialog on Linux when zenity is missing, and none when neither is there", () => {
    expect(FolderDialog.command("linux", ["zenity", "kdialog"])?.program).toBe("zenity");
    expect(FolderDialog.command("linux", ["kdialog"])?.program).toBe("kdialog");
    expect(FolderDialog.command("linux", [])).toBeUndefined();
  });
});
