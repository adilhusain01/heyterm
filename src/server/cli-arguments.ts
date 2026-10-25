// What was typed after `heyterm`.

export interface ParsedArguments {
  command: string | undefined;
  port: string | undefined;
  open: boolean;
  help: boolean;
}

export class CliArguments {
  static parse(args: string[]): ParsedArguments {
    const portIndex = args.indexOf("--port");
    const port = portIndex === -1 ? undefined : args[portIndex + 1];
    const command = args.find((argument, index) => !argument.startsWith("-") && !(portIndex !== -1 && index === portIndex + 1));
    return { command, port, open: !args.includes("--no-open"), help: args.includes("--help") || args.includes("-h") };
  }
}
