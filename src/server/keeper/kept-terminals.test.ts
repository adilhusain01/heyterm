import { afterEach, describe, expect, it } from "vitest";
import { KeeperService } from "./keeper-service.ts";
import { KeptTerminals } from "./kept-terminals.ts";
import { InMemoryChannel } from "./keeper-channel.ts";
import { LaunchCommand } from "../terminals/launch-command.ts";
import { TerminalHost } from "../terminals/terminal-host.ts";

const hosts: TerminalHost[] = [];

afterEach(() => {
  for (const host of hosts.splice(0)) host.shutdown();
});

async function waitFor(check: () => boolean | Promise<boolean>, milliseconds = 10_000): Promise<void> {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timed out");
}

// The keeper with a server connected to it, as one HeyTerm run has.
async function connectServer(service: KeeperService): Promise<KeptTerminals> {
  const [serverEnd, keeperEnd] = InMemoryChannel.pair();
  const terminals = new KeptTerminals(serverEnd);
  service.serve(keeperEnd);
  await terminals.ready;
  return terminals;
}

function keeper(): KeeperService {
  const host = new TerminalHost();
  hosts.push(host);
  return new KeeperService(host);
}

// A program that echoes each line it reads, so typing into it shows on its screen.
function echoProgram(): { program: string; args: string[] | string } {
  const { file, args } = LaunchCommand.forPlatform("node", ["-e", "process.stdin.on('data', (data) => process.stdout.write('got ' + data)); console.log('ready')"]);
  return { program: file, args };
}

describe("Terminals kept outside the server", () => {
  it("run a program the server starts and show what it printed", async () => {
    const terminals = await connectServer(keeper());
    terminals.createSession({ name: "api", workingDirectory: process.cwd(), environment: {}, ...echoProgram() });
    expect(terminals.hasSession("api")).toBe(true);
    await waitFor(async () => (await terminals.captureScreen("api")).includes("ready"));
  }, 20_000);

  it("take what is typed into a page and send back what the program prints", async () => {
    const terminals = await connectServer(keeper());
    terminals.createSession({ name: "api", workingDirectory: process.cwd(), environment: {}, ...echoProgram() });
    await waitFor(async () => (await terminals.captureScreen("api")).includes("ready"));
    let shown = "";
    const attachment = terminals.attach("api", { send: (data) => void (shown += data), close: () => undefined }, 100, 30);
    expect(attachment).toBeDefined();
    await waitFor(() => shown.includes("ready"));
    attachment!.write("hello\r");
    await waitFor(() => shown.includes("got hello"));
  }, 20_000);

  // Adil, 26 October 2026: every restart of HeyTerm ended his Claude sessions, so they had to be
  // brought back with --resume each time.
  it("keep running when the server goes away, and the next server finds them with their screen", async () => {
    const service = keeper();
    const firstServer = await connectServer(service);
    firstServer.createSession({ name: "api", workingDirectory: process.cwd(), environment: {}, ...echoProgram() });
    await waitFor(async () => (await firstServer.captureScreen("api")).includes("ready"));
    firstServer.close();

    const nextServer = await connectServer(service);
    expect(nextServer.listSessions()).toEqual([{ name: "api" }]);
    let shown = "";
    nextServer.attach("api", { send: (data) => void (shown += data), close: () => undefined }, 100, 30)!.write("still here\r");
    await waitFor(() => shown.includes("ready") && shown.includes("got still here"));
  }, 20_000);

  it("say when a program ends by itself", async () => {
    const terminals = await connectServer(keeper());
    const ended: string[] = [];
    terminals.on("exit", (name) => ended.push(name));
    const { file, args } = LaunchCommand.forPlatform("node", ["-e", "console.log('bye')"]);
    terminals.createSession({ name: "short", workingDirectory: process.cwd(), program: file, args, environment: {} });
    await waitFor(() => ended.includes("short"));
    expect(terminals.hasSession("short")).toBe(false);
  }, 20_000);

  it("rename, end and paste into terminals through the keeper", async () => {
    const terminals = await connectServer(keeper());
    terminals.createSession({ name: "api", workingDirectory: process.cwd(), environment: {}, ...echoProgram() });
    await waitFor(async () => (await terminals.captureScreen("api")).includes("ready"));
    terminals.renameSession("api", "gateway");
    expect(terminals.listSessions()).toEqual([{ name: "gateway" }]);
    terminals.pasteText("gateway", "pasted");
    terminals.pressKeys("gateway", ["Enter"]);
    await waitFor(async () => (await terminals.captureScreen("gateway")).includes("got pasted"));
    terminals.killSession("gateway");
    expect(terminals.hasSession("gateway")).toBe(false);
  }, 20_000);

  it("end every terminal when HeyTerm stops for good", async () => {
    const service = keeper();
    const terminals = await connectServer(service);
    terminals.createSession({ name: "api", workingDirectory: process.cwd(), environment: {}, ...echoProgram() });
    await waitFor(async () => (await terminals.captureScreen("api")).includes("ready"));
    terminals.shutdown();
    await waitFor(() => service.runningNames().length === 0);
  }, 20_000);
});
