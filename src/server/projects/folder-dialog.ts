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
  static command(platform: NodeJS.Platform): FolderDialogCommand | undefined {
    // "activate" brings the dialog to the front, over the browser, without asking to control another app.
    if (platform === "darwin") return { program: "osascript", args: ["-e", "activate", "-e", `POSIX path of (choose folder with prompt "${prompt}")`] };
    if (platform === "win32") {
      const script = `Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = '${prompt}'; if ($dialog.ShowDialog() -eq 'OK') { $dialog.SelectedPath }`;
      return { program: "powershell.exe", args: ["-NoProfile", "-STA", "-Command", script] };
    }
    if (platform === "linux") return { program: "zenity", args: ["--file-selection", "--directory", `--title=${prompt}`] };
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
    if (platform !== "linux") return FolderDialog.command(platform) !== undefined;
    // Linux has no dialog of its own; zenity is there on most desktops, and never on a server.
    if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return false;
    return execFileAsync("zenity", ["--version"], { timeout: 3_000 }).then(() => true, () => false);
  }

  static async choose(platform: NodeJS.Platform = process.platform): Promise<string | undefined> {
    const command = FolderDialog.command(platform);
    if (!command) return undefined;
    // A cancelled dialog exits with an error; that is no folder, not a failure.
    const output = await execFileAsync(command.program, command.args, { timeout: dialogTimeoutMilliseconds }).then(
      ({ stdout }) => stdout,
      () => "",
    );
    return FolderDialog.chosenPath(output, platform);
  }
}
