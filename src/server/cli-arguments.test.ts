import { describe, expect, it } from "vitest";
import { CliArguments } from "./cli-arguments.ts";

describe("CliArguments.parse", () => {
  it("reads the command when no port is given", () => {
    expect(CliArguments.parse(["stop"])).toEqual({ command: "stop", port: undefined, open: true, help: false });
  });

  it("reads the port and the command in either order", () => {
    expect(CliArguments.parse(["--port", "5000", "stop"])).toMatchObject({ command: "stop", port: "5000" });
    expect(CliArguments.parse(["uninstall", "--port", "5000"])).toMatchObject({ command: "uninstall", port: "5000" });
  });

  it("starts by default, and knows --no-open and --help", () => {
    expect(CliArguments.parse([])).toEqual({ command: undefined, port: undefined, open: true, help: false });
    expect(CliArguments.parse(["--no-open"])).toMatchObject({ open: false });
    expect(CliArguments.parse(["-h"])).toMatchObject({ help: true });
  });
});
