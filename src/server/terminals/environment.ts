// The environment Callsign hands to the programs it starts.

// Set by a running Claude Code for the programs it starts (seen in Claude Code 2.1.310). A session
// that inherits them believes it is a sub-agent and, among other things, saves no transcript.
// Variables people set themselves, such as CLAUDE_CODE_USE_BEDROCK, are kept.
const inheritedMarkers = new Set([
  "CLAUDECODE",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_EXECPATH",
  "CLAUDE_CODE_MESSAGING_SOCKET",
  "CLAUDE_CODE_MESSAGING_TOKEN",
  "CLAUDE_CODE_SESSION_ATTENDED",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_SSE_PORT",
  "CLAUDE_EFFORT",
  "CLAUDE_PID",
  "CALLSIGN_ROUTER",
  "CALLSIGN_SESSION",
]);

export function withoutInheritedMarkers(environment: NodeJS.ProcessEnv): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(environment)) if (value !== undefined && !inheritedMarkers.has(key)) kept[key] = value;
  return kept;
}
