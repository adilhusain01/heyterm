// Routes an utterance the fast path could not, with Claude. Uses the API when a key is set,
// otherwise `claude -p` on the user's own Claude Code login, so nothing needs configuring.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { z } from "zod";
import { routerSystemPrompt, routerUserMessage } from "./model-router-prompt.ts";
import type { RouterAction, RoutingContext } from "../../shared/types.ts";

const RouterDecision = z.object({
  action: z.enum(["send", "answer", "approve", "deny", "trust", "interrupt", "catch_up", "status", "focus", "spawn", "close", "resume", "clarify", "unknown"]),
  session: z.string().nullable(),
  project: z.string().nullable(),
  text: z.string().nullable(),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })).nullable(),
  clarifyQuestion: z.string().nullable(),
  clarifyOptions: z.array(z.string()).nullable(),
});

type RouterDecision = z.infer<typeof RouterDecision>;

const cliTimeoutMilliseconds = 25_000;

export class ModelRouter {
  private readonly client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : undefined;

  constructor(
    private readonly model: string,
    private readonly workingDirectory: string,
  ) {}

  async route(utterance: string, context: RoutingContext, recentlyClosedNames: string[]): Promise<RouterAction> {
    const message = routerUserMessage(utterance, context, recentlyClosedNames);
    const decision = this.client ? await this.decideWithApi(message) : await this.decideWithClaudeCode(message);
    return decision ? actionFromDecision(decision, context, recentlyClosedNames) : { type: "unknown", reason: "The router did not answer." };
  }

  private async decideWithApi(message: string): Promise<RouterDecision | undefined> {
    const response = await this.client!.beta.messages.parse({
      model: this.model,
      max_tokens: 4_000,
      system: routerSystemPrompt,
      messages: [{ role: "user", content: message }],
      output_config: { effort: "low", format: betaZodOutputFormat(RouterDecision) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") return undefined;
    return response.parsed_output ?? undefined;
  }

  private async decideWithClaudeCode(message: string): Promise<RouterDecision | undefined> {
    await mkdir(this.workingDirectory, { recursive: true });
    const args = [
      "-p",
      "--model", this.model,
      "--effort", "low",
      "--tools", "",
      "--no-session-persistence",
      "--setting-sources", "",
      "--strict-mcp-config",
      "--system-prompt", routerSystemPrompt,
      "--output-format", "json",
      "--json-schema", decisionJsonSchema(),
    ];
    const output = await runWithInput("claude", args, message, this.workingDirectory, cliTimeoutMilliseconds);
    const result = parseLastJsonObject(output) as { structured_output?: unknown } | undefined;
    const parsed = RouterDecision.safeParse(result?.structured_output);
    return parsed.success ? parsed.data : undefined;
  }
}

function actionFromDecision(decision: RouterDecision, context: RoutingContext, recentlyClosedNames: string[]): RouterAction {
  const session = context.sessions.find((candidate) => candidate.name === decision.session);
  const text = decision.text?.trim() ?? "";
  const unknownSession: RouterAction = { type: "unknown", reason: "I could not tell which session you meant." };
  switch (decision.action) {
    case "send":
      return session && text ? { type: "send", session: session.name, text, needsPreview: true } : unknownSession;
    case "answer": {
      if (session?.pending?.kind !== "question" || !decision.answers?.length) return unknownSession;
      const answers = Object.fromEntries(decision.answers.map((answer) => [answer.question, answer.answer]));
      return { type: "answer", session: session.name, requestId: session.pending.requestId, answers };
    }
    case "approve":
      // The model can approve, never confirm: a high-risk request still needs the spoken "confirm".
      return session?.pending?.kind === "permission" ? { type: "approve", session: session.name, requestId: session.pending.requestId, confirmed: false } : unknownSession;
    case "deny":
      if (session?.pending?.kind !== "permission") return unknownSession;
      return text ? { type: "deny", session: session.name, requestId: session.pending.requestId, reason: text } : { type: "deny", session: session.name, requestId: session.pending.requestId };
    case "trust":
    case "interrupt":
    case "status":
    case "focus":
      return session ? { type: decision.action, session: session.name } : unknownSession;
    case "close":
      return session ? { type: "close", session: session.name, confirmed: false } : unknownSession;
    case "resume":
      return decision.session && recentlyClosedNames.includes(decision.session) ? { type: "resume", session: decision.session } : unknownSession;
    case "catch_up":
      return session ? { type: "catch_up", session: session.name } : { type: "catch_up" };
    case "spawn": {
      if (!decision.project || !context.projectNames.includes(decision.project)) return { type: "unknown", reason: "I could not find that project." };
      return text ? { type: "spawn", project: decision.project, task: text } : { type: "spawn", project: decision.project };
    }
    case "clarify": {
      const options = (decision.clarifyOptions ?? []).filter((option) => context.sessions.some((candidate) => candidate.name === option));
      if (options.length < 2) return unknownSession;
      return { type: "clarify", question: decision.clarifyQuestion ?? "Which session?", options };
    }
    case "unknown":
      return { type: "unknown", reason: text || "I did not catch what to do." };
  }
}

// The CLI's schema check knows no "$schema" line, so it is left out.
function decisionJsonSchema(): string {
  const { $schema: _unusedSchemaLine, ...schema } = z.toJSONSchema(RouterDecision) as Record<string, unknown>;
  return JSON.stringify(schema);
}

function runWithInput(command: string, args: string[], input: string, workingDirectory: string, timeoutMilliseconds: number): Promise<string> {
  return new Promise((resolve) => {
    const environment = { ...process.env };
    // A router call must never look like a Callsign session, or like a nested Claude Code session.
    for (const key of Object.keys(environment)) {
      if (key === "CALLSIGN_SESSION" || key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) delete environment[key];
    }
    environment.CALLSIGN_ROUTER = "1";
    const child = spawn(command, args, { cwd: workingDirectory, env: environment, stdio: ["pipe", "pipe", "ignore"] });
    let output = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMilliseconds);
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", () => resolve(""));
    child.on("close", () => {
      clearTimeout(timer);
      resolve(output);
    });
    child.stdin.end(input);
  });
}

function parseLastJsonObject(output: string): unknown {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(output.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
