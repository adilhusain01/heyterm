// The command lines that agents run for HeyTerm's hooks. They work in sh, zsh, bash and cmd, so
// the same text serves macOS, Linux and Windows.

export const forwardScriptName = "heyterm-forward.cjs";
// What older versions added (it was called Callsign then), so they can be cleaned up too.
const olderScriptNames = ["callsign-forward.cjs", "forward-existing-event.sh", "forward-event.sh"];

export class HookCommands {
  // For sessions HeyTerm started: the forwarder exits at once in any other session.
  static forSession(scriptPath: string, eventName: string): string {
    return `node ${quoted(scriptPath)} heyterm ${eventName}`;
  }

  // For agents that read hooks only from global files (Grok Build, Cursor). The forwarder checks the
  // agent is really the one named, since Grok also runs the hooks in Cursor's file.
  static forAgent(scriptPath: string, eventName: string, agent: "grok" | "cursor"): string {
    return `node ${quoted(scriptPath)} agent ${eventName} ${agent}`;
  }

  // For the user's own settings. If HeyTerm has been removed and the script is gone, this does
  // nothing and fails nothing, so the user never sees a hook error.
  static forExistingSessions(scriptPath: string, eventName: string): string {
    return `node -e "try{require(process.argv[1])}catch(e){}" ${quoted(scriptPath)} external ${eventName}`;
  }

  static isHeyTerm(command: string): boolean {
    return [forwardScriptName, ...olderScriptNames].some((name) => command.includes(name));
  }

  // A hook of this copy of HeyTerm (its own forwarder), or one left by HeyTerm's old name.
  static belongsTo(command: string, scriptPath: string): boolean {
    return command.includes(quoted(scriptPath)) || olderScriptNames.some((name) => command.includes(name));
  }
}

// Paths go in double quotes, which every shell reads the same way as long as nothing inside them
// can start a substitution.
function quoted(scriptPath: string): string {
  if (/["$`%!\r\n]/.test(scriptPath)) throw new Error(`HeyTerm's data folder path cannot be used in a hook command: ${scriptPath}`);
  return `"${scriptPath}"`;
}
