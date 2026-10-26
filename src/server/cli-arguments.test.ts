import { describe, expect, it } from "vitest";
import { CliArguments } from "./cli-arguments.ts";

describe("CliArguments.parse", () => {
  it("reads the command when no port is given", () => {
    expect(CliArguments.parse(["stop"])).toEqual({ command: "stop", commandArguments: [], port: undefined, open: true, help: false, remoteHost: false, acceptedHostNames: [] });
  });

  it("reads the port and the command in either order", () => {
    expect(CliArguments.parse(["--port", "5000", "stop"])).toMatchObject({ command: "stop", port: "5000" });
    expect(CliArguments.parse(["uninstall", "--port", "5000"])).toMatchObject({ command: "uninstall", port: "5000" });
  });

  it("starts by default, and knows --no-open and --help", () => {
    expect(CliArguments.parse([])).toEqual({ command: undefined, commandArguments: [], port: undefined, open: true, help: false, remoteHost: false, acceptedHostNames: [] });
    expect(CliArguments.parse(["--no-open"])).toMatchObject({ open: false });
    expect(CliArguments.parse(["-h"])).toMatchObject({ help: true });
  });

  // HeyTerm on a VPS, serving the HeyTerm on a Mac (26 October 2026).
  it("reads --remote-host and every --allow-host name", () => {
    expect(CliArguments.parse(["--remote-host", "--allow-host", "vps.example.ts.net", "--allow-host", "vps"])).toMatchObject({ command: undefined, remoteHost: true, acceptedHostNames: ["vps.example.ts.net", "vps"] });
  });

  it("reads what follows a command, such as remote add vps and its address", () => {
    expect(CliArguments.parse(["remote", "add", "vps", "https://vps.example.ts.net:8443"])).toMatchObject({ command: "remote", commandArguments: ["add", "vps", "https://vps.example.ts.net:8443"] });
    expect(CliArguments.parse(["--port", "5000", "remote", "list"])).toMatchObject({ command: "remote", commandArguments: ["list"], port: "5000" });
  });
});
