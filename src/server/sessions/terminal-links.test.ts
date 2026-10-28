import { describe, expect, it } from "vitest";
import { TerminalLinks } from "./terminal-links.ts";
import type { ClaudeSessionRecord } from "./claude-session-status.ts";

const record = (sessionId: string, pid: number): ClaudeSessionRecord => ({ sessionId, pid, entrypoint: "cli", kind: "interactive", cwd: "/p" });

describe("TerminalLinks.find", () => {
  // Adil, 28 October 2026: Claude started by hand in a HeyTerm terminal showed up as a second,
  // empty session "in your own terminal" beside the terminal it was running in.
  it("links a Claude running on a terminal's own screen to that terminal", () => {
    const links = TerminalLinks.find([{ name: "web-terminal", processes: [{ pid: 400, args: "-zsh" }, { pid: 501, args: "claude" }] }], [record("8fd9f8e2-aaaa", 501)]);
    expect(links).toEqual([{ terminal: "web-terminal", agentSessionId: "8fd9f8e2-aaaa" }]);
  });

  // On the VPS, claude starts a background session and attaches to it in screen: the session's own
  // process belongs to Claude's daemon, and the terminal shows "claude attach <id>".
  it("links a background session the terminal is attached to, by the id it names", () => {
    const processes = [
      { pid: 10, args: "-bash" },
      { pid: 11, args: "SCREEN -dRR cc-4450a7ab claude attach 4450a7ab" },
      { pid: 12, args: "claude attach 4450a7ab" },
    ];
    const links = TerminalLinks.find([{ name: "projects-terminal", processes }], [record("4450a7ab-0495-4f71-89f0-e030c0c93e9d", 2328969)]);
    expect(links).toEqual([{ terminal: "projects-terminal", agentSessionId: "4450a7ab-0495-4f71-89f0-e030c0c93e9d" }]);
  });

  it("links a conversation resumed in the terminal by its id", () => {
    const links = TerminalLinks.find([{ name: "t", processes: [{ pid: 7, args: "claude --resume 4450a7ab-0495-4f71-89f0-e030c0c93e9d" }] }], [record("4450a7ab-0495-4f71-89f0-e030c0c93e9d", 999)]);
    expect(links).toEqual([{ terminal: "t", agentSessionId: "4450a7ab-0495-4f71-89f0-e030c0c93e9d" }]);
  });

  it("links nothing when no Claude runs in any terminal", () => {
    expect(TerminalLinks.find([{ name: "t", processes: [{ pid: 7, args: "npm test" }] }], [record("4450a7ab", 999)])).toEqual([]);
  });
});
