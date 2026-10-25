import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { forwardScript } from "./forward-script.ts";

let server: http.Server | undefined;
afterEach(() => server?.close());

async function startServer(answer: string): Promise<{ port: number; requests: Array<{ url: string; token: string; body: string }> }> {
  const requests: Array<{ url: string; token: string; body: string }> = [];
  server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      requests.push({ url: request.url ?? "", token: String(request.headers["x-heyterm-token"] ?? ""), body });
      response.end(answer);
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return { port: (server!.address() as { port: number }).port, requests };
}

async function writeScript(port: number): Promise<string> {
  const scriptPath = path.join(await mkdtemp(path.join(os.tmpdir(), "heyterm-forward-")), "heyterm-forward.cjs");
  await writeFile(scriptPath, forwardScript(port, "secret-token"));
  return scriptPath;
}

function run(scriptPath: string, args: string[], environment: Record<string, string>, input: string): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [scriptPath, ...args], { env: { PATH: process.env.PATH ?? "", ...environment } }, (error, stdout) =>
      resolve({ stdout, code: error ? Number((error as { code?: number }).code ?? 1) : 0 }),
    );
    child.stdin!.end(input);
  });
}

describe("the hook forwarder", () => {
  it("sends a HeyTerm session's event with the token and prints HeyTerm's answer", async () => {
    const { port, requests } = await startServer('{"decision":"x"}');
    const result = await run(await writeScript(port), ["heyterm", "PermissionRequest"], { HEYTERM_SESSION: "web" }, '{"tool_name":"Bash"}');
    expect(result).toEqual({ stdout: '{"decision":"x"}', code: 0 });
    expect(requests).toEqual([{ url: "/hooks/PermissionRequest?session=web", token: "secret-token", body: '{"tool_name":"Bash"}' }]);
  });

  it("stays out of sessions HeyTerm did not start", async () => {
    const { port, requests } = await startServer("answer");
    const result = await run(await writeScript(port), ["heyterm", "Stop"], {}, "{}");
    expect(result).toEqual({ stdout: "", code: 0 });
    expect(requests).toEqual([]);
  });

  it("reports the user's own sessions as outside ones, and never the assistant's", async () => {
    const { port, requests } = await startServer("");
    const scriptPath = await writeScript(port);
    await run(scriptPath, ["external", "Stop"], {}, "{}");
    await run(scriptPath, ["external", "Stop"], { HEYTERM_ROUTER: "1" }, "{}");
    expect(requests.map((request) => request.url)).toEqual(["/hooks/Stop?external=1"]);
  });

  it("lets the agent carry on, silently, when HeyTerm is not running", async () => {
    const scriptPath = await writeScript(1);
    const started = Date.now();
    const result = await run(scriptPath, ["heyterm", "Stop"], { HEYTERM_SESSION: "web" }, "{}");
    expect(result).toEqual({ stdout: "", code: 0 });
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it("refuses an event name that is not a plain word", async () => {
    const { port, requests } = await startServer("");
    await run(await writeScript(port), ["heyterm", "../shutdown"], { HEYTERM_SESSION: "web" }, "{}");
    expect(requests).toEqual([]);
  });
});
