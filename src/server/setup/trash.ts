// Moves a folder to the system's Trash, so nothing HeyTerm removes is gone for good.

import { execFile } from "node:child_process";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function moveToTrash(target: string): Promise<void> {
  if (process.platform === "darwin") return moveIntoFolder(target, path.join(os.homedir(), ".Trash"));
  if (process.platform === "win32") return moveToRecycleBin(target);
  return moveToFreedesktopTrash(target);
}

async function moveIntoFolder(target: string, trashFolder: string): Promise<void> {
  await rename(target, await freeName(trashFolder, path.basename(target)));
}

// The Trash that Linux desktops share (freedesktop.org), with the note that lets them put it back.
async function moveToFreedesktopTrash(target: string): Promise<void> {
  const trashHome = path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "Trash");
  await mkdir(path.join(trashHome, "files"), { recursive: true });
  await mkdir(path.join(trashHome, "info"), { recursive: true });
  const destination = await freeName(path.join(trashHome, "files"), path.basename(target));
  const info = `[Trash Info]\nPath=${encodeURI(target)}\nDeletionDate=${new Date().toISOString().slice(0, 19)}\n`;
  await writeFile(path.join(trashHome, "info", `${path.basename(destination)}.trashinfo`), info);
  await rename(target, destination);
}

async function moveToRecycleBin(target: string): Promise<void> {
  const quoted = target.replaceAll("'", "''");
  const script = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${quoted}', 'OnlyErrorDialogs', 'SendToRecycleBin')`;
  await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { timeout: 30_000 });
}

async function freeName(folder: string, name: string): Promise<string> {
  let candidate = path.join(folder, name);
  for (let number = 2; await exists(candidate); number += 1) candidate = path.join(folder, `${name} ${number}`);
  return candidate;
}

async function exists(target: string): Promise<boolean> {
  return stat(target).then(
    () => true,
    () => false,
  );
}
