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
const sessionName = process.env.HEYTERM_SESSION;
const isHeyTermSession = origin === "heyterm" && Boolean(sessionName);
const isOutsideSession = origin === "external" && !sessionName && !process.env.HEYTERM_ROUTER;
if ((!isHeyTermSession && !isOutsideSession) || !/^[A-Za-z]+$/.test(eventName)) process.exit(0);

const query = isHeyTermSession ? "session=" + encodeURIComponent(sessionName) : "external=1";
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
      response.on("end", () => {
        if (response.statusCode === 200) process.stdout.write(Buffer.concat(answer));
        process.exit(0);
      });
    },
  );
  request.on("timeout", () => request.destroy());
  request.on("error", () => process.exit(0));
  request.end(body);
});
`;
}
