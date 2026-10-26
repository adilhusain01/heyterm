// What was typed after `heyterm`.

export interface ParsedArguments {
  command: string | undefined;
  // The words after the command, for commands that take them (heyterm remote add vps <address>).
  commandArguments: string[];
  port: string | undefined;
  open: boolean;
  help: boolean;
  // Serve another computer's HeyTerm instead of a page here (heyterm on a VPS).
  remoteHost: boolean;
  acceptedHostNames: string[];
}

// Options that take the next word as their value.
const optionsWithValues = new Set(["--port", "--allow-host"]);

export class CliArguments {
  static parse(args: string[]): ParsedArguments {
    const positional: string[] = [];
    const acceptedHostNames: string[] = [];
    let port: string | undefined;
    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index]!;
      if (optionsWithValues.has(argument)) {
        const value = args[index + 1];
        index += 1;
        if (value === undefined) continue;
        if (argument === "--port") port = value;
        else acceptedHostNames.push(value);
        continue;
      }
      if (!argument.startsWith("-")) positional.push(argument);
    }
    const [command, ...commandArguments] = positional;
    return {
      command,
      commandArguments,
      port,
      open: !args.includes("--no-open") && !args.includes("--remote-host"),
      help: args.includes("--help") || args.includes("-h"),
      remoteHost: args.includes("--remote-host"),
      acceptedHostNames,
    };
  }
}
