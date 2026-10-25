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
- Claude Code sends no hook when the user interrupts a turn, and none when its terminal is closed. Claude Code keeps a record of each live process in `~/.claude/sessions` (pid, session id, status `busy`, `waiting`, `idle` or `shell`), and HeyTerm reads them every 2 seconds: a working, asking or permission-waiting session whose record turned idle or shell after that state began (and at least 3 seconds ago, so a late `Stop` still wins) returns to idle; a session from the user's own terminal whose record or process is gone, 30 seconds or more into its state, is closed. Sessions from the user's terminal are kept across a HeyTerm restart and checked the same way; with no records folder (an older Claude Code) they are dropped at start, as before. Checked live on 25 October 2026 with Claude Code 2.1.310.
- HeyTerm checks its Grok and Cursor hooks every 30 seconds while it runs and puts them back if something removed them. Adding or removing Cursor hooks touches only this copy's own forwarder and leftovers from the old name, so two copies with different data folders keep each other's.
- The page files are read from disk on each request. The server names the page script its `index.html` loaded at start; a page from an older build reloads once, and a page newer than the server (an update while HeyTerm runs) asks for a restart. Words and clicks that waited more than 10 seconds for a connection are dropped, and the page says so.
- A brought-back session always runs in HeyTerm's own terminal, whichever terminal it ran in before, and bringing one back is refused while Claude Code's records show another live process with the same conversation open, since two processes writing one conversation can tangle it. "Open X here" (the assistant's `open_session_here`, and **Open here** on the pane) moves a Claude session from the user's terminal into HeyTerm: its process is sent SIGTERM, HeyTerm waits up to 8 seconds for it to exit, and the conversation is resumed in HeyTerm. A working session is asked about first. The assistant reports only what its tools returned.
- An image dropped on a session's terminal pane, or pasted while that terminal has focus, is sent to `POST /attachments?session=<name>` (token required; PNG, JPEG, GIF or WebP; at most 20 MB), saved as `~/.heyterm/attachments/<session>-<date>-<time>-<random>.<type>` readable by the user alone, and its path is pasted into the session's prompt without Enter, which is what a terminal does when an image file is dragged into it; Claude Code shows it as `[Image #n]`. A session in the user's own terminal, or one waiting on a decision, is told why it cannot take the image. Text pastes reach the terminal as before.
- Every session name is unique across open and recently closed sessions, so "bring back mine" means one session. Closed sessions saved under one name by an older version are told apart at start: the newest keeps it, older ones get `-2`, `-3`.
- Any open or recently closed session can be renamed from its sidebar row, by saying "rename synqed to synqed auth", or through the assistant. Names are lowercase words joined by hyphens, up to 40 characters. A session HeyTerm started keeps reporting under its launch name, so that name stays reserved while it is listed. A closed session can be removed from the list; its conversation stays with the agent.
- A turn that ends in a question is "asked", one that does not is "done". HeyTerm reads the last message to tell them apart.
- The one thing hooks do not report is the folder trust dialog on a new folder. HeyTerm reads the screen for that one case, and for sessions that have not reported anything yet.
- Text is pasted as a bracketed paste (control characters dropped, so text can never press keys), then a carriage return. Delivery counts only when `UserPromptSubmit` arrives within 2.5 seconds; otherwise HeyTerm presses return again once and then says the send failed. (Found in the probe of 24 October 2026: a return sent right after start was swallowed.)
- If you answer a question or permission by hand in the terminal, the pending hook is resolved as answered elsewhere when the tool's `PostToolUse`, the next prompt or the end of the turn arrives.
- Closing a session that is working, or has uncommitted changes, asks first; "yes" or "confirm" closes it. Closing keeps the transcript, so "bring back peeker" resumes it.
- HeyTerm never deletes the user's folders. A new session in a folder another open session uses (the same folder, one inside it, or one around it) works in a git worktree of its own: branch `heyterm/<session>` (a number added if taken), made from HEAD, at `~/.heyterm/worktrees/<repo>-<session>`, the same subfolder when the project sits inside the repository. Its start message says so; outside git, or in a repository with no commits, the folder is shared and the message warns. Removing the closed session from the list deletes the worktree and its branch only when the worktree has no uncommitted changes and no commits past the one it was made from; otherwise it stays and the message says where. Closing a session that is working or has uncommitted changes still asks first.
- A working session that sends no hook event for 5 minutes, or that has been running one shell command (from its `PreToolUse` to its `PostToolUse`) for 10, gets a quiet notice, checked every 30 seconds: an attention item after finished work, spoken in Speaking mode only, with a low sound of its own. Any hook event clears it, and it is said once per quiet stretch.

## Voice

- The command bar holds focus whenever no terminal is in typing mode, so Wispr's text always lands there.
- Text that arrives in one burst (two or more characters in one input event) is treated as dictation and sent after 600 ms of quiet; a keyboard adds one character per event. Short answers such as "Yes." count as dictation too. Typed text waits for Enter. The split also feeds the hands-off meter, with key presses in a terminal pane counted as keyboard use.
- The fast path handles the common commands without a model: approve, deny, confirm, cancel, catch me up, what is X doing, what did X change, go to X, close X, rename X to Y, start a session in X, tell X to ..., X: ..., quiet, speak, the first/second one. Anything else, including "catch me up", status questions and a confirm that nothing in HeyTerm is waiting for, goes to the assistant.
- Session names are matched by spelling and by sound ("synced" finds Synqed, "book boy" finds BookBoy, "peaker" finds Peeker).
- With no name, an answer goes to the session at the top of the attention queue when it asked something; any other words go to the assistant, which decides where they belong.
- Every send shows a preview ("to bookboy: go with Neon") with a 1.5 second countdown. "cancel", "no", "wait" or Escape stops it; "send" sends at once. Answers to a question that was just read out go without a countdown.
- The assistant is one long-lived Claude conversation (Opus 5.5 at low effort, Agent SDK, the user's own Claude login or the API when `ANTHROPIC_API_KEY` is set). Each turn carries the current situation: every session, its state and its last words. What sessions said is wrapped as data, never instructions. Its tools read a session's screen and last message, send it work, answer, approve, deny, start (in any folder), close, bring back, interrupt and show sessions; on top of those it has everything Claude Code has, with the user's own MCP servers, skills, CLAUDE.md and permission rules. Nothing it runs may touch a PrivateKeys folder (a PreToolUse hook denies it). It runs whatever the user's Claude Code permission mode allows. When that mode would ask the user, the assistant asks out loud and waits for "approve", "yes" or "confirm" (or "no"); two minutes without an answer is a no. It is told it can do anything Claude Code can on the Mac (install tools, write files and scripts, search the web, look at the screen through `screencapture`), while coding in a project still goes to that project's session unless the user asks it to do the work itself. Its conversation is saved and resumed by id after a timeout, a crash or a restart (`assistant.json` in the data folder, which also keeps the conversation column's last 80 lines); an id that cannot be resumed is dropped and the next turn starts fresh.
- Each session keeps the files its last task changed: those its own edit hooks reported, and those git shows changed between a snapshot taken when the task started and one when it ended (HEAD, plus a content hash of every changed or new file), so edits made through shell commands count. In a repository shared by sessions working at once, git cannot tell whose shell edit was whose. The finished line counts them ("Changed 2 files"), "what did api change?" names them with line counts since the last commit, and the assistant has the same through `session_changes`. It also gets a finished session's whole reply, not only its first sentence.
- When something newly needs the user, the assistant is told and says what the session wants and the exact reply, in a sentence or two, without reading commands, paths or code aloud. If it has not answered in 9 seconds, a plain line is said instead.
- Replies are spoken up to a line of `---`; anything after it is shown only. The conversation column shows what the user said, the replies, the assistant's steps and what happened in the sessions.

## Sessions started outside HeyTerm

- Setup's **Connect my sessions** adds HeyTerm's hooks to `~/.claude/settings.json`, after copying the file to `~/.heyterm/backups`. **Disconnect** removes exactly those entries. A settings file that is not valid JSON is refused, never overwritten.
- Those hooks run a second script that reports only sessions HeyTerm did not start (and never the router's own calls), so no session reports twice.
- An outside session appears under its title or folder name. Its permissions and questions can be answered by voice and it is announced like any other, but HeyTerm does not type into it and does not close it; it says so when asked.
- When HeyTerm restarts, outside sessions are forgotten until their next event. A dialog HeyTerm was holding in one of its own sessions stays on screen in the terminal; that session is marked as blocked by the dialog, refuses typed text, and is announced as waiting on a dialog in its terminal until it reports again.

## Grok Build and Cursor

- Both read hooks only from global files. While HeyTerm runs, Grok gets `~/.grok/hooks/heyterm.json` and Cursor gets HeyTerm's entries added to `~/.cursor/hooks.json`; both come out on stop and on uninstall, and a Cursor file that held nothing else is removed.
- Every hook is tagged with its agent and runs only under that agent (`GROK_HOOK_EVENT` for Grok, `CURSOR_VERSION` for Cursor), because Grok also runs the hooks in Cursor's and Claude's files. The user's own Claude hooks never report a Grok or Cursor session.
- A Grok session starts under a session id HeyTerm chose (`grok -s`) and resumes with `grok -r`. A Cursor conversation is claimed by the newest Cursor session HeyTerm started in that folder. Events from any other session are ignored.
- Only reporting events are registered; none can approve or block a tool. Grok's permission card is shown as waiting in its terminal. Grok's folder-trust card is answered with its `y` key, Cursor's with its `a` key; Cursor leaves the answered card on screen, so only a card that still shows its hint line counts as asking. Cursor's prompt hook always replies `{"continue":true}`.
- Checked live on 25 October 2026 with Grok Build 1.0.70: trust, a task sent by name, the finished state and its message. Checked live the same day with Cursor 2026.10.22: trust by voice, a task sent by name, the finished state and its message.

## Answers and approvals

- A multiple-choice question from Claude (`AskUserQuestion`) is answered from the hook with the option you named ("the second one", "Neon"), so no arrow keys are pressed.
- A permission is announced in plain words with its risk named (deleting, force pushing, publishing, deploying, database drops, `sudo`, piping a download into a shell), never the command read out. "approve", "yes" or "confirm" approves it, high risk or not: the agent asked, and HeyTerm adds no gate of its own.
- A denial carries your words to Claude as the reason ("no, use pnpm") so it can change course.
- Every decision, by voice or click, is written to `~/.heyterm/audit.jsonl` with the time, session, command and the words that decided it.
- A request that waits on a decision (permission, question, trust, failure) goes into the conversation the moment it arrives, as a message that can be answered there. It stays answerable while the session still waits on that same request (same session, kind and start time) and settles once it does not. A request older than the 80 kept lines is still shown at the end.
- An answer shows in the conversation as the user's own message: the words when spoken, and when clicked, the words that would have been said ("Approve web", "Trust ultron", "api: Postgres"). Finished work is news, told as an event line, never as a request.

## Attention

- Queue order: permission, question, trust dialog, failure, finished. Within one kind, the one waiting longest first.
- Each item shows how long it has waited. The sidebar's footer shows how long agents waited on you today.
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

## Look

- Gruvbox Material in light (the default) and dark, chosen in Setup under Appearance (Light, Dark or System). The choice is applied before the page draws, so it never flashes the other theme. Terminals use Gruvbox Material dark in both.
- The page is checked on every load, so an updated HeyTerm shows at once; built assets carry a content hash and are kept.

## Install

- `heyterm` starts the server and opens the browser (or opens the one already running); `heyterm stop` stops it; `heyterm uninstall` stops it, removes its hooks from the user's Claude settings and moves `~/.heyterm` to the Trash; `heyterm doctor` checks Node 20+ and which agents are installed. Terminals use `@lydell/node-pty`, which ships prebuilt for macOS, Linux and Windows, so installing runs no build scripts. CI runs the tests and an install, start, stop and uninstall smoke check on all three.
- The server is bundled to `dist/server/cli.js` and the UI to `dist/web`.

## Out of scope for the first version

Sessions on another machine, agents other than Claude Code, git worktrees made by HeyTerm, typing into outside sessions (the cross-session inbox would deliver text only as a message from another session), and phone control.
