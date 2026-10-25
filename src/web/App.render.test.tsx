// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { Announcer } from "./voice/announcer.ts";
import type { CallsignConnection, ConnectionHandlers, TerminalChannel } from "./transport/connection.ts";
import type { ServerMessage } from "../shared/protocol.ts";
import type { SessionView } from "../shared/types.ts";

const session: SessionView = {
  name: "portfolio",
  projectPath: "/p/portfolio",
  projectName: "portfolio",
  agent: "codex",
  state: "needs_permission",
  stateSince: 0,
  createdAt: 0,
  lastSeenAt: 0,
  activitySinceSeen: [],
  waitedMillisecondsToday: 0,
  pending: { kind: "permission", requestId: "r", toolName: "Bash", toolInput: {}, summary: "git push --force origin main\n".repeat(20), risk: "high", riskReasons: ["force pushes"], createdAt: 0 },
};

const messages: ServerMessage[] = [
  { type: "snapshot", sessions: [session], recentlyClosed: [{ name: "ultron", projectName: "ultron" }], projects: ["portfolio", "ultron"], control: { mode: "speak", routing: false }, serverTime: 0 } as ServerMessage,
  { type: "setup", setup: { agents: [{ kind: "claude", label: "Claude Code", version: "2.1.310", installHint: "" }, { kind: "codex", label: "Codex", version: "0.164.0", installHint: "" }], claudeVersion: "2.1.310", testedClaudeVersion: "2.1.310", claudeVersionIsTested: true, nodeVersion: "22", projectRoots: [], projectCount: 2, existingSessionsConnected: false, routerSource: "claude-code", routerModel: "claude-opus-5-5", macVoiceAvailable: true, keepRunningWithoutPage: false } },
  { type: "conversation", entries: [{ id: 1, at: 0, kind: "user", text: "what is everyone doing?" }, { id: 2, at: 0, kind: "assistant", text: "Portfolio wants to force push." }] },
];

class FakeConnection implements CallsignConnection {
  connect(handlers: ConnectionHandlers): () => void {
    handlers.onStatus("open");
    queueMicrotask(() => messages.forEach((message) => handlers.onMessage(message)));
    return () => undefined;
  }
  send(): void {}
  openTerminal(): TerminalChannel {
    return { onData: () => undefined, onClose: () => undefined, write: () => undefined, resize: () => undefined, close: () => undefined };
  }
}

// Tells React this is a test environment, so act() is supported.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("the whole page", () => {
  it("renders every part from the server's messages without crashing or looping", async () => {
    // Browser features jsdom does not have.
    vi.stubGlobal("speechSynthesis", { cancel: () => undefined, speak: () => undefined, getVoices: () => [] });
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const errors: unknown[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation((...args) => void errors.push(args));
    const container = document.createElement("div");
    document.body.append(container);
    await act(async () => {
      createRoot(container).render(<App connection={new FakeConnection()} announcer={new Announcer()} />);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const text = container.textContent ?? "";
    expect(text).toContain("portfolio");
    expect(text).toContain("Wants to run a command");
    expect(text).toContain("Portfolio wants to force push.");
    expect(text).toContain("ultron");
    expect(errors.map((error) => String((error as unknown[])[0]).slice(0, 160))).toEqual([]);

    // Dictation arrives as a paste; something else on the page (an extension) tries to cancel it.
    document.addEventListener("paste", (event) => event.preventDefault(), { capture: false });
    const bar = container.querySelector<HTMLInputElement>('input[aria-label="Talk to Callsign"]')!;
    bar.focus();
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { getData: (type: string) => (type === "text/plain" ? "start a session in portfolio" : "") } });
    await act(async () => {
      bar.dispatchEvent(paste);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(bar.value).toBe("start a session in portfolio");
    consoleError.mockRestore();
  });
});
