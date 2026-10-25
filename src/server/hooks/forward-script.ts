// The script every agent hook runs: it sends one event to HeyTerm on this computer and prints
// HeyTerm's answer. Plain Node, so it runs the same on macOS, Linux and Windows. When HeyTerm is
// not running it prints nothing and the agent carries on as if no hook existed.

// Permission requests wait for the user's answer; everything else must not slow the agent down.
export const permissionWaitSeconds = 590;

export function forwardScript(port: number, token: string): string {
  return `// Written by HeyTerm. Forwards one agent hook event to HeyTerm on this computer.
"use strict";
const http = require("http");
const origin = process.argv[2];
const eventName = process.argv[3] || "";
const agentKind = process.argv[4] || "";
const sessionName = process.env.HEYTERM_SESSION;
// Grok and Cursor set these on every hook they run. Grok also runs the hooks in Cursor's and
// Claude's files, so a hook knows which agent really ran it only by these.
const ranByGrok = Boolean(process.env.GROK_HOOK_EVENT);
const ranByCursor = Boolean(process.env.CURSOR_VERSION) && !ranByGrok;
const isHeyTermSession = origin === "heyterm" && Boolean(sessionName);
const isOutsideSession = origin === "external" && !sessionName && !process.env.HEYTERM_ROUTER && !ranByGrok && !process.env.CURSOR_VERSION;
const isAgentEvent = origin === "agent" && ((agentKind === "grok" && ranByGrok) || (agentKind === "cursor" && ranByCursor));
// Cursor reads a prompt hook's reply as a verdict, so its prompt always gets a "go ahead".
const defaultReply = ranByCursor && agentKind === "cursor" && eventName === "beforeSubmitPrompt" ? '{"continue":true}' : "";
const finish = (answer) => {
  process.stdout.write(answer || defaultReply);
  process.exit(0);
};
if ((!isHeyTermSession && !isOutsideSession && !isAgentEvent) || !/^[A-Za-z]+$/.test(eventName)) finish("");

const query = isHeyTermSession ? "session=" + encodeURIComponent(sessionName) : isAgentEvent ? "agent=" + agentKind : "external=1";
const waitSeconds = eventName === "PermissionRequest" ? ${permissionWaitSeconds} : 3;
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const body = Buffer.concat(chunks);
  const request = http.request(
    {
      host: "127.0.0.1",
      port: ${port},
      path: "/hooks/" + eventName + "?" + query,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": body.length, "X-HeyTerm-Token": ${JSON.stringify(token)} },
      timeout: waitSeconds * 1000,
    },
    (response) => {
      const answer = [];
      response.on("data", (chunk) => answer.push(chunk));
      response.on("end", () => finish(response.statusCode === 200 ? Buffer.concat(answer).toString() : ""));
    },
  );
  request.on("timeout", () => request.destroy());
  request.on("error", () => finish(""));
  request.end(body);
});
`;
}
