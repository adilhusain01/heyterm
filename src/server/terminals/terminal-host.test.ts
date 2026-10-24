import { afterEach, describe, expect, it } from "vitest";
import { LaunchCommand } from "./launch-command.ts";
import { TerminalHost } from "./terminal-host.ts";

const posixOnly = process.platform === "win32" ? describe.skip : describe;
const hosts: TerminalHost[] = [];

function makeHost(): TerminalHost {
  const host = new TerminalHost();
  hosts.push(host);
  return host;
}

async function waitFor(check: () => boolean | Promise<boolean>, milliseconds = 5_000): Promise<void> {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timed out");
}

describe("TerminalHost on every system", () => {
  it("starts a program through the system's own shell and reads what it printed", async () => {
    const host = makeHost();
    const { file, args } = LaunchCommand.forPlatform("node", ["-e", "console.log('hello from ' + process.platform); setTimeout(() => {}, 3000)"]);
    host.createSession({ name: "anywhere", workingDirectory: process.cwd(), program: file, args, environment: {} });
    await waitFor(async () => (await host.captureScreen("anywhere")).includes(`hello from ${process.platform}`), 15_000);
  }, 20_000);
});

afterEach(() => {
  for (const host of hosts.splice(0)) host.shutdown();
});

posixOnly("TerminalHost", () => {
  it("runs a program and reads its screen", async () => {
    const host = makeHost();
    host.createSession({ name: "one", workingDirectory: "/tmp", program: "/bin/sh", args: ["-c", "echo ready; sleep 5"], environment: {} });
    await waitFor(async () => (await host.captureScreen("one")).includes("ready"));
    expect(host.hasSession("one")).toBe(true);
  });

  it("pastes text and presses Enter in the program", async () => {
    const host = makeHost();
    host.createSession({ name: "two", workingDirectory: "/tmp", program: "/bin/sh", args: ["-c", 'read line; echo "got [$line]"; sleep 5'], environment: {} });
    host.pasteText("two", "hello there");
    host.pressKeys("two", ["Enter"]);
    await waitFor(async () => (await host.captureScreen("two")).includes("got [hello there]"));
  });

  it("passes the session's environment to the program", async () => {
    const host = makeHost();
    host.createSession({ name: "three", workingDirectory: "/tmp", program: "/bin/sh", args: ["-c", 'echo "name=$CALLSIGN_SESSION"; sleep 5'], environment: { CALLSIGN_SESSION: "three" } });
    await waitFor(async () => (await host.captureScreen("three")).includes("name=three"));
  });

  it("starts programs without Claude Code's own markers, even when Callsign runs inside Claude Code", async () => {
    process.env.CLAUDE_CODE_CHILD_SESSION = "1";
    process.env.CLAUDECODE = "1";
    process.env.CLAUDE_CODE_USE_BEDROCK = "1";
    try {
      const host = makeHost();
      host.createSession({ name: "clean", workingDirectory: "/tmp", program: "/bin/sh", args: ["-c", 'echo "markers=[${CLAUDECODE}${CLAUDE_CODE_CHILD_SESSION}] own=[${CLAUDE_CODE_USE_BEDROCK}]"; sleep 5'], environment: {} });
      await waitFor(async () => (await host.captureScreen("clean")).includes("markers=[] own=[1]"));
    } finally {
      delete process.env.CLAUDE_CODE_CHILD_SESSION;
      delete process.env.CLAUDECODE;
      delete process.env.CLAUDE_CODE_USE_BEDROCK;
    }
  });

  it("reports when a program ends by itself and forgets the session", async () => {
    const host = makeHost();
    const ended: string[] = [];
    host.on("exit", (name) => ended.push(name));
    host.createSession({ name: "four", workingDirectory: "/tmp", program: "/bin/sh", args: ["-c", "exit 0"], environment: {} });
    await waitFor(() => ended.includes("four"));
    expect(host.hasSession("four")).toBe(false);
  });

  it("gives a page that attaches later the screen so far, then what comes next", async () => {
    const host = makeHost();
    host.createSession({ name: "five", workingDirectory: "/tmp", program: "/bin/sh", args: ["-c", "echo before; read x; echo after; sleep 5"], environment: {} });
    await waitFor(async () => (await host.captureScreen("five")).includes("before"));
    let received = "";
    const attachment = host.attach("five", { send: (data) => (received += data), close: () => undefined }, 80, 24);
    await waitFor(() => received.includes("before"));
    attachment!.write("\r");
    await waitFor(() => received.includes("after"));
    attachment!.detach();
  });

  it("ends every program on shutdown", async () => {
    const host = makeHost();
    host.createSession({ name: "six", workingDirectory: "/tmp", program: "/bin/sh", args: ["-c", "sleep 30"], environment: {} });
    host.shutdown();
    expect(host.listSessions()).toEqual([]);
  });
});
