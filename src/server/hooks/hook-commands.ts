// The command lines that agents run for Callsign's hooks. They work in sh, zsh, bash and cmd, so
// the same text serves macOS, Linux and Windows.

export const forwardScriptName = "callsign-forward.cjs";
// What older versions of Callsign added, so they can be cleaned up too.
const olderScriptNames = ["forward-existing-event.sh", "forward-event.sh"];

export class HookCommands {
  // For sessions Callsign started: the forwarder exits at once in any other session.
  static forSession(scriptPath: string, eventName: string): string {
    return `node ${quoted(scriptPath)} callsign ${eventName}`;
  }

  // For the user's own settings. If Callsign has been removed and the script is gone, this does
  // nothing and fails nothing, so the user never sees a hook error.
  static forExistingSessions(scriptPath: string, eventName: string): string {
    return `node -e "try{require(process.argv[1])}catch(e){}" ${quoted(scriptPath)} external ${eventName}`;
  }

  static isCallsign(command: string): boolean {
    return [forwardScriptName, ...olderScriptNames].some((name) => command.includes(name));
  }
}

// Paths go in double quotes, which every shell reads the same way as long as nothing inside them
// can start a substitution.
function quoted(scriptPath: string): string {
  if (/["$`%!\r\n]/.test(scriptPath)) throw new Error(`Callsign's data folder path cannot be used in a hook command: ${scriptPath}`);
  return `"${scriptPath}"`;
}
