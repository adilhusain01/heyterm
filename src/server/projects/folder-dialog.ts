// The system's own folder dialog, for "Choose a folder…" in the picker: it opens on the computer
// HeyTerm runs on and gives back the chosen folder's path, which a web page cannot read itself.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const prompt = "Choose a folder for the new session";
// Long enough to browse to a folder; the dialog closes by itself after it.
const dialogTimeoutMilliseconds = 5 * 60_000;

export interface FolderDialogCommand {
  program: string;
  args: string[];
}

export class FolderDialog {
  // installedPrograms: the dialog programs found on this computer; unknown means the platform's usual one.
  static command(platform: NodeJS.Platform, installedPrograms?: string[]): FolderDialogCommand | undefined {
    const has = (program: string) => installedPrograms === undefined || installedPrograms.includes(program);
    // "activate" brings the dialog to the front, over the browser, without asking to control another app.
    if (platform === "darwin") return { program: "osascript", args: ["-e", "activate", "-e", `POSIX path of (choose folder with prompt "${prompt}")`] };
    if (platform === "win32") {
      // PowerShell 7 runs on .NET, whose folder dialog is Explorer's own; Windows PowerShell's is the old tree.
      const script = `Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = '${prompt}'; $dialog.UseDescriptionForTitle = $true; if ($dialog.ShowDialog() -eq 'OK') { $dialog.SelectedPath }`;
      const program = installedPrograms?.includes("pwsh") ? "pwsh" : "powershell.exe";
      return { program, args: ["-NoProfile", "-STA", "-Command", script] };
    }
    if (platform === "linux") {
      if (has("zenity")) return { program: "zenity", args: ["--file-selection", "--directory", `--title=${prompt}`] };
      if (installedPrograms?.includes("kdialog")) return { program: "kdialog", args: ["--getexistingdirectory", process.env.HOME ?? "/", "--title", prompt] };
    }
    return undefined;
  }

  // What the dialog printed: the folder, or nothing when it was cancelled.
  static chosenPath(output: string, platform: NodeJS.Platform): string | undefined {
    const chosen = output.trim();
    if (!chosen) return undefined;
    // macOS ends a folder's POSIX path with a slash.
    return platform === "darwin" && chosen.length > 1 ? chosen.replace(/\/$/, "") : chosen;
  }

  static async isAvailable(platform: NodeJS.Platform = process.platform): Promise<boolean> {
    return FolderDialog.command(platform, await FolderDialog.installedPrograms(platform)) !== undefined;
  }

  static async choose(platform: NodeJS.Platform = process.platform): Promise<string | undefined> {
    const command = FolderDialog.command(platform, await FolderDialog.installedPrograms(platform));
    if (!command) return undefined;
    // A cancelled dialog exits with an error; that is no folder, not a failure.
    const output = await execFileAsync(command.program, command.args, { timeout: dialogTimeoutMilliseconds }).then(
      ({ stdout }) => stdout,
      () => "",
    );
    return FolderDialog.chosenPath(output, platform);
  }

  // Which of the dialog programs this computer has. Linux has no dialog of its own (zenity is on most
  // desktops, kdialog on KDE) and none at all without a display, as on a server.
  private static async installedPrograms(platform: NodeJS.Platform): Promise<string[]> {
    const candidates = platform === "win32" ? ["pwsh"] : platform === "linux" ? ["zenity", "kdialog"] : [];
    if (platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return [];
    const found = await Promise.all(candidates.map((program) => execFileAsync(program, ["--version"], { timeout: 3_000, shell: platform === "win32" }).then(() => program, () => undefined)));
    return found.filter((program): program is string => program !== undefined);
  }
}
