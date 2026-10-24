# Callsign

Run your coding agents by voice. Callsign is one window for all your Claude Code sessions, with a voice layer in the middle: you talk through Wispr Flow (or any dictation tool), Callsign works out which session you mean and does it, and it tells you when a session needs you. Five agents at once, no keyboard, no trackpad.

## Why

When you run several agents in parallel, they spend a lot of time waiting for you. On one developer's Mac over two weeks, sessions finished or stopped to ask something 179 times while the developer was busy in another session. Those waits added up to 55 session-hours, with a median of 5.5 minutes and the longest at 3 hours 25 minutes. Measure your own with:

```bash
python3 scripts/measure-waits.py
```

## What you can say

| You say | Callsign does |
| --- | --- |
| "start a session in portfolio and fix the phone menu" | starts Claude Code in that project and gives it the task |
| "peeker, run the tests again" / "tell bookboy to use Neon" | sends your words to that session, after a 1.5 second preview you can cancel |
| "approve" / "no, use pnpm instead" | answers the permission at the top of the queue; a "no" passes your reason to Claude |
| "confirm" | approves a risky command (deleting, force pushing, deploying, publishing) |
| "Neon" / "the second one" | answers a multiple-choice question, with no arrow keys |
| "catch me up" / "what's synqed doing?" | says what changed since you last looked |
| "trust it" | trusts a new folder for the session asking |
| "go to whisker" / "stop synqed" / "close peeker" / "bring back peeker" | focus, interrupt, close and resume |
| "be quiet" / "mute" / "talk to me" | announcements for questions and permissions only, sounds only, or everything |

Common commands are understood on your computer at once. Anything else goes to Claude (Opus 5.5 at low effort) through your own Claude Code login, so there is no API key to set up.

## Getting started

You need macOS or Linux, Node.js 20 or newer, [tmux](https://github.com/tmux/tmux), and [Claude Code](https://code.claude.com) signed in once.

```bash
brew install tmux          # or: sudo apt install tmux
npx callsign-cli doctor    # checks everything Callsign needs
npx callsign-cli           # starts Callsign and opens it in your browser
```

Until the package is on npm, run it from source instead:

```bash
git clone https://github.com/adilhusain01/callsign && cd callsign
npm install && npm run build
node bin/callsign.js
```

Then:

1. Click anywhere on the page once, so the browser lets Callsign speak.
2. Open Setup and check your project folders. Callsign looks in `~/Documents/Projects`, `~/Projects`, `~/code`, `~/dev`, `~/src` and `~/Developer` by default.
3. Hold your dictation key (Fn for Wispr Flow) and say "start a session in" followed by a project name.
4. Use headphones, so Callsign's spoken alerts never end up in your own dictation.

To see the Claude sessions you start in your own terminals as well, open Setup and click **Connect my sessions**. Callsign adds its hooks to `~/.claude/settings.json` (after saving a backup in `~/.callsign/backups`), and **Disconnect** takes them out again. It can answer those sessions' permissions and questions and tell you when they finish, but it can only type into sessions it started.

## How it works

- **Sessions run in tmux** on Callsign's own socket, so they keep running if Callsign stops, and you can open any of them in your own terminal with `tmux -L callsign attach -t <name>`.
- **Claude Code hooks report every state**, so nothing is guessed from the screen. A permission or a multiple-choice question is held open until you answer by voice; answering in the terminal by hand still works, and wins.
- **Risky commands always come to you**, even in auto mode: Callsign's `PreToolUse` hook makes Claude ask before deleting, force pushing, deploying or publishing, and only "confirm" approves them.
- **Text is sent as a real prompt**, pasted into the session and confirmed by its `UserPromptSubmit` hook.
- **Announcements wait for you.** Nothing is spoken while text is arriving in the command bar, and events that arrive together are read as one sentence.

## Privacy and safety

- The server listens on `127.0.0.1` only. It refuses requests from other sites and checks a private token on every hook, so a web page cannot approve anything for you.
- Every decision, by voice or click, goes into `~/.callsign/audit.jsonl` with the time, the session, the command and the words that decided it.
- Callsign never deletes a folder or a worktree. Closing a session that is working or has uncommitted changes needs "confirm".

## Settings

All optional; see `.env.example`.

| Variable | What it changes |
| --- | --- |
| `CALLSIGN_PORT` | the port (default 4747) |
| `CALLSIGN_PROJECT_ROOTS` | project folders, separated by `:` (Setup saves the same thing) |
| `CALLSIGN_ROUTER_MODEL` | the model for unclear commands (default `claude-opus-5-5`) |
| `ANTHROPIC_API_KEY` | route unclear commands through the Claude API instead of your Claude Code login |

## Development

```bash
npm install
npm run dev        # server with reload on :4747, UI with reload on :5173
npm test           # 110 tests
npm run typecheck
npm run build      # dist/web and dist/server/cli.js
npm run build:playground   # dist/playground: the same UI on three simulated agents, a static site anyone can open
```

`docs/SPEC.md` is the behaviour Callsign promises, and the tests are written from it. Pure decisions (routing, risk, session states, the attention queue) live in their own files with tests beside them.

Built for [No Hands: The Wispr Challenge](https://www.wemakedevs.org/wispr) by WeMakeDevs and Wispr Flow.
