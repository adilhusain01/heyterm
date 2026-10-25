// The assistant between the user and their sessions: one long-lived Claude conversation on the
// user's own Claude Code login, fed what the user says and what happens in the sessions.

import { query, type HookCallback, type McpSdkServerConfigWithInstance, type Query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { conductorSystemPrompt } from "./conductor-prompt.ts";
import { withoutInheritedMarkers } from "../terminals/environment.ts";
import { TurnQueue, type TurnPriority } from "./turn-queue.ts";
import type { ConversationEntryKind } from "../../shared/protocol.ts";

// A turn that takes longer than this is stopped, so one stuck command never blocks the assistant.
const turnTimeoutMilliseconds = 180_000;

interface ConductorOptions {
  model: string;
  workingDirectory: string;
  tools: McpSdkServerConfigWithInstance;
  beforeTool: HookCallback;
  // Asks the developer, when Claude Code's permission mode would; resolves to their answer.
  askDeveloper: (toolName: string, toolInput: Record<string, unknown>) => Promise<boolean>;
}

interface QueuedTurn {
  text: string;
  resolve: (reply: string) => void;
  reject: (error: Error) => void;
}

interface ConductorEvents {
  activity: [ConversationEntryKind, string];
  busy: [boolean];
}

export class Conductor extends EventEmitter<ConductorEvents> {
  private readonly turns = new TurnQueue<QueuedTurn>();
  private currentTurn: QueuedTurn | undefined;
  private session: Query | undefined;
  private sendToSession: ((message: SDKUserMessage) => void) | undefined;
  private turnTimer: NodeJS.Timeout | undefined;

  constructor(private readonly options: ConductorOptions) {
    super();
  }

  // Resolves with the assistant's reply to this turn. Turns run one at a time, in order.
  ask(text: string, priority: TurnPriority): Promise<string> {
    return new Promise((resolve, reject) => {
      this.turns.add({ text, resolve, reject }, priority);
      this.startNextTurn();
    });
  }

  // HeyTerm is stopping: end the assistant's process and fail anything still waiting.
  close(): void {
    const session = this.session;
    this.session = undefined;
    session?.close();
    this.finishTurn(undefined, new Error("HeyTerm is stopping."));
    for (let turn = this.turns.next(); turn; turn = this.turns.next()) turn.reject(new Error("HeyTerm is stopping."));
  }

  private startNextTurn(): void {
    if (this.currentTurn) return;
    const turn = this.turns.next();
    if (!turn) return;
    this.currentTurn = turn;
    this.emit("busy", true);
    this.turnTimer = setTimeout(() => {
      // Closed rather than interrupted, so a late reply to this turn can never answer the next one.
      this.session?.close();
      this.session = undefined;
      this.finishTurn(undefined, new Error("The assistant took too long and was stopped."));
    }, turnTimeoutMilliseconds);
    this.ensureSession();
    this.sendToSession!({ type: "user", message: { role: "user", content: turn.text }, parent_tool_use_id: null, origin: { kind: "human" } } as SDKUserMessage);
  }

  private finishTurn(reply: string | undefined, error?: Error): void {
    const turn = this.currentTurn;
    if (!turn) return;
    clearTimeout(this.turnTimer);
    this.currentTurn = undefined;
    if (error) turn.reject(error);
    else turn.resolve(reply ?? "");
    this.emit("busy", this.turns.size > 0);
    this.startNextTurn();
  }

  private ensureSession(): void {
    if (this.session) return;
    const waiting: SDKUserMessage[] = [];
    let wake: (() => void) | undefined;
    this.sendToSession = (message) => {
      waiting.push(message);
      wake?.();
    };
    async function* input(): AsyncGenerator<SDKUserMessage> {
      while (true) {
        while (waiting.length > 0) yield waiting.shift()!;
        await new Promise<void>((resolve) => (wake = resolve));
      }
    }
    this.session = query({
      prompt: input(),
      options: {
        model: this.options.model,
        effort: "low",
        // Everything Claude Code can do, with the voice rules on top.
        systemPrompt: { type: "preset", preset: "claude_code", append: conductorSystemPrompt },
        cwd: this.options.workingDirectory,
        pathToClaudeCodeExecutable: claudeExecutablePath(),
        // The user's own setup: their MCP servers, skills, CLAUDE.md and permission rules.
        settingSources: ["user"],
        persistSession: false,
        tools: { type: "preset", preset: "claude_code" },
        mcpServers: { heyterm: this.options.tools },
        // The mode the developer's own Claude Code sessions run in (their plan's default), so the
        // assistant asks exactly when Claude Code would.
        permissionMode: "auto",
        hooks: { PreToolUse: [{ hooks: [this.options.beforeTool], timeout: 120 }] },
        // The assistant asks the developer in words, not with an on-screen question.
        disallowedTools: ["AskUserQuestion"],
        // HeyTerm's own tools only act on sessions, so they never need the developer's OK. They are
        // allowed here rather than in allowedTools, which would bypass this callback with a warning.
        canUseTool: async (toolName, input) =>
          toolName.startsWith("mcp__heyterm__") || (await this.options.askDeveloper(toolName, input))
            ? { behavior: "allow", updatedInput: input }
            : { behavior: "deny", message: "The developer said no, or did not answer. Do not try another way; tell them it was not done." },
        // HEYTERM_ROUTER keeps the user's connected-session hooks from treating this as a session of theirs.
        env: { ...withoutInheritedMarkers(process.env), HEYTERM_ROUTER: "1" },
      },
    });
    void this.readSession(this.session);
  }

  private async readSession(session: Query): Promise<void> {
    try {
      for await (const message of session) {
        // A session closed after a timeout may still deliver; it must not touch the next turn.
        if (this.session !== session) return;
        if (message.type === "assistant") {
          for (const block of message.message.content) {
            if (block.type === "tool_use") this.emit("activity", "tool", describeToolUse(block.name, block.input));
          }
        }
        if (message.type === "result") {
          if (message.subtype === "success") this.finishTurn(message.result);
          else this.finishTurn(undefined, new Error("The assistant could not finish that."));
        }
      }
    } catch {
      // Reported below as the turn that could not finish.
    } finally {
      // The process ended. A turn still waiting fails, and the next turn starts a fresh conversation.
      if (this.session === session) {
        this.session = undefined;
        this.finishTurn(undefined, new Error("The assistant stopped unexpectedly."));
      }
    }
  }
}

function describeToolUse(toolName: string, input: unknown): string {
  const fields = (input ?? {}) as Record<string, unknown>;
  const shortName = toolName.replace(/^mcp__heyterm__/, "");
  if (toolName === "Bash") return `run ${String(fields.command ?? "")}`;
  if (toolName === "Read") return `read ${String(fields.file_path ?? "")}`;
  const firstValue = Object.values(fields).find((value) => typeof value === "string") as string | undefined;
  return firstValue ? `${shortName.replaceAll("_", " ")}: ${firstValue}` : shortName.replaceAll("_", " ");
}

function claudeExecutablePath(): string | undefined {
  try {
    return execFileSync("which", ["claude"], { encoding: "utf8" }).trim() || undefined;
  } catch {
    return undefined;
  }
}
