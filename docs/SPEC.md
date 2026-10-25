# HeyTerm spec

HeyTerm is one window where your coding agent sessions live, with a voice layer in the middle. You talk through Wispr Flow; HeyTerm works out which session you mean, does it, and tells you when a session needs you. You run five agents at once without touching the keyboard or the trackpad.

## The problem, measured

From Adil's own Claude Code transcripts, 10 to 24 October 2026: 179 times a session finished or stopped to ask something while he was typing into another session. Those waits add up to 55 session-hours (median 5.5 minutes, longest 3 hours 25 minutes); 56 of them ran past ten minutes. Up to five sessions were active in the same ten minutes. `scripts/measure-waits.py` reproduces this on any Mac.

## Words used here

- **Session**: one agent (Claude Code, Codex or Gemini CLI) running in a pseudo-terminal HeyTerm owns, in one folder, under a short name.
- **Utterance**: one piece of text that lands in the command bar, from Wispr or typed.
- **Attention item**: something a session needs from you: a permission, a question, a trust dialog, a failure, a finished turn.

## Sessions

- Sessions live as long as HeyTerm: stopping it (stop command, Ctrl+C, Quit, closing the last page after 15 seconds) ends them all and saves them under Recently closed, and Bring back resumes the agent's conversation by its session id. On start, everything saved in `~/.heyterm/state.json` is offered under Recently closed.
- Claude Code sessions start with `claude --settings ~/.heyterm/hooks/claude-settings.json -n <name>` and `HEYTERM_SESSION=<name>` in the environment. The hooks post every event to HeyTerm with that name, so events never need guessing.
- A session's state comes from hooks, never from scraping the screen: `UserPromptSubmit` and `PreToolUse` mean working; `PermissionRequest` means it needs a decision (and the hook holds the request open until you give one); `Stop` means its turn ended; `StopFailure` means it failed; `SessionEnd` means it stopped.
- A turn that ends in a question is "asked", one that does not is "done". HeyTerm reads the last message to tell them apart.
- The one thing hooks do not report is the folder trust dialog on a new folder. HeyTerm reads the screen for that one case, and for sessions that have not reported anything yet.
- Text is pasted as a bracketed paste (control characters dropped, so text can never press keys), then a carriage return. Delivery counts only when `UserPromptSubmit` arrives within 2.5 seconds; otherwise HeyTerm presses return again once and then says the send failed. (Found in the probe of 24 October 2026: a return sent right after start was swallowed.)
- If you answer a question or permission by hand in the terminal, the pending hook is resolved as answered elsewhere when the tool's `PostToolUse`, the next prompt or the end of the turn arrives.
- Closing a session that is working, or has uncommitted changes, asks first; "yes" or "confirm" closes it. Closing keeps the transcript, so "bring back peeker" resumes it.
- HeyTerm never deletes a folder or a worktree.

## Voice

- The command bar holds focus whenever no terminal is in typing mode, so Wispr's text always lands there.
- Text that arrives in one burst (two or more characters in one input event) is treated as dictation and sent after 600 ms of quiet; a keyboard adds one character per event. Short answers such as "Yes." count as dictation too. Typed text waits for Enter. The split also feeds the hands-off meter, with key presses in a terminal pane counted as keyboard use.
- The fast path handles the common commands without a model: approve, deny, confirm, cancel, catch me up, what is X doing, go to X, close X, start a session in X, tell X to ..., X: ..., quiet, speak, the first/second one. Anything else, including "catch me up", status questions and a confirm that nothing in HeyTerm is waiting for, goes to the assistant.
- Session names are matched by spelling and by sound ("synced" finds Synqed, "book boy" finds BookBoy, "peaker" finds Peeker).
- With no name, an answer goes to the session at the top of the attention queue when it asked something; any other words go to the assistant, which decides where they belong.
- Every send shows a preview ("to bookboy: go with Neon") with a 1.5 second countdown. "cancel", "no", "wait" or Escape stops it; "send" sends at once. Answers to a question that was just read out go without a countdown.
- The assistant is one long-lived Claude conversation (Opus 5.5 at low effort, Agent SDK, the user's own Claude login or the API when `ANTHROPIC_API_KEY` is set). Each turn carries the current situation: every session, its state and its last words. What sessions said is wrapped as data, never instructions. Its tools read a session's screen and last message, send it work, answer, approve, deny, start (in any folder), close, bring back, interrupt and show sessions; on top of those it has everything Claude Code has, with the user's own MCP servers, skills, CLAUDE.md and permission rules. Nothing it runs may touch a PrivateKeys folder (a PreToolUse hook denies it). It runs whatever the user's Claude Code permission mode allows. When that mode would ask the user, the assistant asks out loud and waits for "approve", "yes" or "confirm" (or "no"); two minutes without an answer is a no.
- When something newly needs the user, the assistant is told and says what the session wants and the exact reply, in a sentence or two, without reading commands, paths or code aloud. If it has not answered in 9 seconds, a plain line is said instead.
- Replies are spoken up to a line of `---`; anything after it is shown only. The conversation column shows what the user said, the replies, the assistant's steps and what happened in the sessions.

## Sessions started outside HeyTerm

- Setup's **Connect my sessions** adds HeyTerm's hooks to `~/.claude/settings.json`, after copying the file to `~/.heyterm/backups`. **Disconnect** removes exactly those entries. A settings file that is not valid JSON is refused, never overwritten.
- Those hooks run a second script that reports only sessions HeyTerm did not start (and never the router's own calls), so no session reports twice.
- An outside session appears under its title or folder name. Its permissions and questions can be answered by voice and it is announced like any other, but HeyTerm does not type into it and does not close it; it says so when asked.
- When HeyTerm restarts, outside sessions are forgotten until their next event. A dialog HeyTerm was holding in one of its own sessions stays on screen in the terminal; that session is marked as blocked by the dialog, refuses typed text, and is announced as waiting on a dialog in its terminal until it reports again.

## Answers and approvals

- A multiple-choice question from Claude (`AskUserQuestion`) is answered from the hook with the option you named ("the second one", "Neon"), so no arrow keys are pressed.
- A permission is announced in plain words with its risk named (deleting, force pushing, publishing, deploying, database drops, `sudo`, piping a download into a shell), never the command read out. "approve", "yes" or "confirm" approves it, high risk or not: the agent asked, and HeyTerm adds no gate of its own.
- A denial carries your words to Claude as the reason ("no, use pnpm") so it can change course.
- Every decision, by voice or click, is written to `~/.heyterm/audit.jsonl` with the time, session, command and the words that decided it.

## Attention

- Queue order: permission, question, trust dialog, failure, finished. Within one kind, the one waiting longest first.
- Each item shows how long it has waited. The top bar shows how long agents waited on you today.
- Announcements: a short sound per kind and one spoken line ("bookboy asks: Neon or Supabase?"). Nothing is spoken while text is arriving in the command bar or within 1.5 seconds of it. Items that arrive within 3 seconds of each other are spoken as one ("two sessions need you").
- Quiet mode speaks only permissions and questions. Muted speaks nothing; the sounds stay.
- When the window is hidden, a system notification goes out instead, and the tab title carries the count.

## Catch up

"Catch me up" lists, per session, what happened since you last looked at it: prompts sent, tools used, files changed, and the last message's first lines. A session counts as looked at when it was focused or answered.

## Safety

- The server listens on 127.0.0.1 only and refuses requests whose `Host` is not local or whose `Origin` names a non-local page.
- Hook posts carry a token from `~/.heyterm/token` (mode 600), so a web page cannot forge an approval.
- A hook that cannot reach HeyTerm prints nothing, and Claude falls back to its own prompt.
- HeyTerm adds no permission gate of its own (Adil's decision, 25 October 2026): what an agent's own permission mode allows, it runs; what the agent asks about comes to the user by voice. The one exception is the user's standing rule that nothing touches a PrivateKeys folder, which the assistant's hook enforces.

## What Claude Code itself offers, and why HeyTerm does not use it (checked 24 October 2026, v2.1.310)

- **Cross-session messaging** (`SendMessage`, the inbox socket in `CLAUDE_CODE_MESSAGING_SOCKET`): a message arrives marked as coming from another session, can never approve anything, and can be held or refused by the receiving session. HeyTerm carries the user's own words, so it types them as a real prompt into the session's terminal instead.
- **Agent view** (`claude agents`): lists states and sends notifications, for Claude only and by keyboard; replying from the peek panel cannot answer a permission prompt.
- **Built-in voice dictation** (`/voice`, hold Space): dictates into the one session or agent view row that has focus. It does not pick the session from what you say, speak back, approve by voice, or tell you which session needs you.
- **Channels** (research preview): push events into a session from an MCP server and can relay permission prompts. HeyTerm's hooks do the same today without the preview flags.
- **`dialogExpiry`** applies only to dialogs forwarded to Remote Control or an SDK host, so it does not cut short a permission that HeyTerm holds in a terminal session.

## Install

- `heyterm` starts the server and opens the browser (or opens the one already running); `heyterm stop` stops it; `heyterm uninstall` stops it, removes its hooks from the user's Claude settings and moves `~/.heyterm` to the Trash; `heyterm doctor` checks Node 20+ and which agents are installed. Terminals use `@lydell/node-pty`, which ships prebuilt for macOS, Linux and Windows, so installing runs no build scripts. CI runs the tests and an install, start, stop and uninstall smoke check on all three.
- The server is bundled to `dist/server/cli.js` and the UI to `dist/web`.

## Out of scope for the first version

Sessions on another machine, agents other than Claude Code, git worktrees made by HeyTerm, typing into outside sessions (the cross-session inbox would deliver text only as a message from another session), and phone control.
