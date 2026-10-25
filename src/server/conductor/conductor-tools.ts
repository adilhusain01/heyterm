// What the assistant can do to sessions. Each tool returns plain words for the assistant to read,
// and never speaks by itself: the assistant decides what the user hears.

import { SessionNames } from "../../shared/session-names.ts";
import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { ActionExecutor } from "../actions/action-executor.ts";
import type { DecisionActions } from "../actions/decision-actions.ts";
import type { SessionActions } from "../actions/session-actions.ts";
import type { ProjectCatalog } from "../projects/project-catalog.ts";
import type { SessionLauncher } from "../sessions/session-launcher.ts";
import type { SessionRegistry } from "../sessions/session-registry.ts";
import type { SessionView } from "../../shared/types.ts";

// The last part of a terminal screen is what matters; the rest is scrollback.
const screenLinesShown = 60;

interface ConductorToolDependencies {
  registry: SessionRegistry;
  launcher: SessionLauncher;
  projects: ProjectCatalog;
  sessionActions: SessionActions;
  decisions: DecisionActions;
  executor: ActionExecutor;
}

export function createConductorTools(dependencies: ConductorToolDependencies): McpSdkServerConfigWithInstance {
  const { registry, launcher, projects, sessionActions, decisions, executor } = dependencies;
  const decidedBy = { decidedBy: "the assistant, on the developer's words" };

  const withSession = async (name: string, act: (session: SessionView) => Promise<string>) => {
    const session = registry.get(name);
    return reply(session ? await act(session) : `There is no session called ${name}. Sessions: ${registry.list().map((known) => known.name).join(", ") || "none"}.`);
  };
  const ownSessionOnly = (session: SessionView, act: () => Promise<string>) =>
    session.origin === "external" ? Promise.resolve(`${session.name} runs in the developer's own terminal. HeyTerm cannot type into it or close it; tell the developer to do it there.`) : act();

  return createSdkMcpServer({
    name: "heyterm",
    version: "1.0.0",
    tools: [
      tool("read_session", "Read one session in full: its state, last task, whole last message, what it waits on, and the end of its terminal screen. Also reads a recently closed session's last task and message.", { name: z.string() }, async ({ name }) => {
        const closed = registry.get(name) ? undefined : registry.recentlyClosedSessions().find((session) => session.name === name);
        if (closed) {
          return reply(
            [
              `${name} is closed (under Recently closed); bring_back_session resumes it. Project folder: ${closed.projectPath}.`,
              closed.lastPrompt ? `Last task: <session_text>${closed.lastPrompt}</session_text>` : "",
              closed.lastMessage ? `Last message: <session_text>${closed.lastMessage}</session_text>` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          );
        }
        return withSession(name, async (session) => {
          sessionActions.markSeen(name);
          const screen = session.origin === "external" ? "" : await launcher.readScreen(name).catch(() => "");
          const lastLines = screen.split("\n").filter((line) => line.trim()).slice(-screenLinesShown).join("\n");
          return [
            `State: ${session.state}. Project folder: ${session.projectPath}.`,
            session.worktree ? `Works in its own git worktree on branch ${session.worktree.branch}, made from ${session.worktree.repoPath}.` : "",
            session.lastPrompt ? `Last task: <session_text>${session.lastPrompt}</session_text>` : "",
            session.lastMessage ? `Last message: <session_text>${session.lastMessage}</session_text>` : "",
            session.pending ? `Waiting on: <session_text>${JSON.stringify(session.pending.kind === "permission" ? { permission: session.pending.summary, risk: session.pending.risk } : { questions: session.pending.questions })}</session_text>` : "",
            lastLines ? `Screen:\n<session_text>${lastLines}</session_text>` : "",
          ]
            .filter(Boolean)
            .join("\n");
        });
      }),
      tool("send_to_session", "Give a session its next prompt, as if the developer typed it. In a terminal session (agent shell) the text runs as a command, and the reply has its output once it finishes, or the screen so far after 15 seconds.", { name: z.string(), text: z.string() }, ({ name, text }) =>
        withSession(name, (session) =>
          ownSessionOnly(session, async () => {
            if (session.agent !== "shell") return (await sessionActions.deliver(name, text)).text;
            const { finished, screen } = await launcher.runInTerminal(name, text);
            const lastLines = screen.split("\n").filter((line) => line.trim()).slice(-screenLinesShown).join("\n");
            return `${finished ? "The command finished." : "The command is still running."} Screen:\n<session_text>${lastLines}</session_text>`;
          }),
        ),
      ),
      tool(
        "answer_question",
        "Answer the multiple-choice question a session is showing. Give one answer per question, using an option label when the developer chose one.",
        { name: z.string(), answers: z.array(z.object({ question: z.string(), answer: z.string() })) },
        ({ name, answers }) =>
          withSession(name, async (session) => {
            if (session.pending?.kind !== "question") return `${name} is not showing a question.`;
            return (await decisions.answer(name, session.pending.requestId, Object.fromEntries(answers.map((entry) => [entry.question, entry.answer])), decidedBy)).text;
          }),
      ),
      tool("approve", "Approve what a session is asking permission for. Only when the developer said so.", { name: z.string() }, ({ name }) =>
        withSession(name, async (session) => {
          if (session.pending?.kind !== "permission") return `${name} is not waiting on a permission.`;
          return executor.approveForAssistant(name, session.pending.requestId);
        }),
      ),
      tool("deny", "Deny what a session is asking permission for, with the developer's reason if they gave one.", { name: z.string(), reason: z.string().optional() }, ({ name, reason }) =>
        withSession(name, async (session) => {
          if (session.pending?.kind !== "permission") return `${name} is not waiting on a permission.`;
          return (await decisions.deny(name, session.pending.requestId, reason, decidedBy)).text;
        }),
      ),
      tool(
        "start_session",
        "Start a new coding agent session in a folder, with its first task if there is one. The folder is a project name from list_projects or any folder path on this Mac, such as ~/Documents/Projects. The agent is Claude Code unless the developer asks for Codex, Gemini, Grok (Grok Build) or Cursor. Agent shell is a plain terminal, the developer's login shell with no agent: use it when they ask to open a terminal or a shell; its task, if any, is a shell command to run.",
        {
          project: z.string().describe("A project name, or a folder path"),
          task: z.string().optional(),
          agent: z.enum(["claude", "codex", "gemini", "grok", "cursor", "shell"]).optional(),
        },
        async ({ project, task, agent }) =>
          reply((await sessionActions.perform({ type: "spawn", project, ...(task ? { task } : {}), ...(agent ? { agent } : {}) }, (sessionName) => executor.setFocus(sessionName))).text),
      ),
      tool("close_session", "Close a session. Ask the developer first when it is working or has uncommitted changes.", { name: z.string(), confirmed: z.boolean().optional() }, ({ name, confirmed }) =>
        withSession(name, (session) =>
          ownSessionOnly(session, async () => {
            if (!confirmed) {
              const warning = await sessionActions.closeWarning(name);
              if (warning) return `${name} ${warning}. Ask the developer, then call again with confirmed.`;
            }
            return (await sessionActions.close(name)).text;
          }),
        ),
      ),
      tool(
        "open_session_here",
        "Move a session that runs in the developer's own terminal into HeyTerm: it closes there and the same conversation reopens here. Use it when they want such a session here. If it is working, ask them first, then call with confirmed.",
        { name: z.string(), confirmed: z.boolean().optional() },
        ({ name, confirmed }) =>
          withSession(name, async (session) => {
            if (session.origin !== "external") return `${name} already runs in HeyTerm.`;
            if (session.state === "working" && !confirmed) return `${name} is still working, and moving it stops its turn. Ask the developer, then call again with confirmed.`;
            return (await sessionActions.adopt(name, (sessionName) => executor.setFocus(sessionName))).text;
          }),
      ),
      tool("bring_back_session", "Bring back a session listed under Recently closed. Not for one still open in the developer's own terminal: use open_session_here for that.", { name: z.string() }, async ({ name }) =>
        reply((await sessionActions.perform({ type: "resume", session: name }, (sessionName) => executor.setFocus(sessionName))).text),
      ),
      tool("interrupt_session", "Stop what a session is doing right now, like pressing Escape.", { name: z.string() }, ({ name }) =>
        withSession(name, (session) => ownSessionOnly(session, async () => (await sessionActions.perform({ type: "interrupt", session: name }, () => undefined)).text)),
      ),
      tool("trust_folder", "Trust the folder a new session is asking about. Only when the developer said so.", { name: z.string() }, ({ name }) =>
        withSession(name, async () => (await sessionActions.perform({ type: "trust", session: name }, () => undefined)).text),
      ),
      tool("session_changes", "List the files a session changed in its last task, from its own edits, with line counts from git. Use it before saying what a session did.", { name: z.string() }, async ({ name }) => {
        const summary = await sessionActions.changes(name);
        return reply([summary.spoken, ...summary.files].join("\n"));
      }),
      tool("rename_session", "Rename an open or recently closed session, so the developer can tell it apart. Works for sessions in their own terminal too.", { name: z.string(), new_name: z.string() }, async ({ name, new_name }) =>
        reply(executor.rename(name, SessionNames.fromTyped(new_name)).text),
      ),
      tool("show_session", "Bring a session onto the developer's screen.", { name: z.string() }, ({ name }) =>
        withSession(name, async () => {
          executor.setFocus(name);
          return `${name} is on screen.`;
        }),
      ),
      tool("list_projects", "List the projects a session can be started in, with their folders.", {}, async () =>
        reply((await projects.list()).map((project) => `${project.name}: ${project.path}`).join("\n") || "No projects found."),
      ),
    ],
  });
}

function reply(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
