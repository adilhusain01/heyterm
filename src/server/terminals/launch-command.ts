// How a session's program is started on each system. It goes through the system shell so that the
// npm shims (claude.cmd, codex.cmd) are found on Windows and PATH works everywhere.

export interface Launch {
  file: string;
  // On Windows a single command line: node-pty would otherwise quote each part again and break cmd's own quoting.
  args: string[] | string;
}

export class LaunchCommand {
  static forPlatform(program: string, args: string[], platform: NodeJS.Platform = process.platform): Launch {
    if (platform === "win32") {
      // With /s, cmd drops the outer pair of quotes and runs what is inside as written.
      return { file: "cmd.exe", args: `/d /s /c "${[program, ...args].map(windowsQuote).join(" ")}"` };
    }
    // exec replaces the shell, so the program gets the terminal's signals directly.
    return { file: "/bin/sh", args: ["-c", `exec ${[program, ...args].map(posixQuote).join(" ")}`] };
  }
}

function posixQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

// cmd has no safe way to escape a quote or a variable inside quotes, so such arguments are refused.
function windowsQuote(value: string): string {
  if (/["%\r\n]/.test(value)) throw new Error(`This argument cannot be passed safely on Windows: ${value}`);
  return `"${value}"`;
}
