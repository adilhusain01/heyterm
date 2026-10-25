// What HeyTerm can tell about a plain terminal session, which sends no hooks: whether a command is
// running (the terminal's foreground program is not the shell), and what it is called. Pure.

import path from "node:path";

export class ShellRules {
  // HeyTerm inherits these from the terminal app it was started in. A shell that gets them takes
  // itself for that app's tab: macOS's zsh restores that tab's session and saves over its history.
  static readonly variablesLeftOut = ["TERM_PROGRAM", "TERM_PROGRAM_VERSION", "TERM_SESSION_ID", "ITERM_SESSION_ID", "ITERM_PROFILE", "LC_TERMINAL", "LC_TERMINAL_VERSION"];

  // A login shell shows as "-zsh". Undefined means the platform does not say (Windows).
  static isCommandRunning(foregroundProgram: string | undefined, shellProgram: string): boolean {
    if (!foregroundProgram) return false;
    const shellName = path.basename(shellProgram).replace(/\.exe$/i, "");
    return foregroundProgram.replace(/^-/, "") !== shellName;
  }

  static sessionName(projectName: string): string {
    return `${projectName}-terminal`;
  }
}
