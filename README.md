<p align="center"><img src="assets/logo-mark.svg" width="96" height="96" alt="HeyTerm"></p>

<p align="center"><a href="https://heyterm.vercel.app">Website</a> · <a href="https://heyterm.vercel.app/playground/">Playground</a> · <a href="https://www.npmjs.com/package/heyterm">npm</a> · <a href="LICENSE">MIT</a> · <a href="SECURITY.md">Security</a></p>

# HeyTerm

Run your coding agents by voice. HeyTerm is one window for all your Claude Code, Codex, Gemini CLI, Grok Build and Cursor sessions, with an assistant in the middle: you talk through Wispr Flow (or any dictation tool), it works out which session you mean and does it, and it tells you when a session needs you. Five agents at once, no keyboard, no trackpad.

## Why

When you run several agents in parallel, they spend a lot of time waiting for you. On one developer's Mac over two weeks, sessions finished or stopped to ask something 179 times while the developer was busy in another session. Those waits added up to 55 session-hours, with a median of 5.5 minutes and the longest at 3 hours 25 minutes. Measure your own with:

```bash
python3 scripts/measure-waits.py
```

## What you can say

| You say | HeyTerm does |
| --- | --- |
| "start a session in portfolio and fix the phone menu" | starts Claude Code in that project and gives it the task |
| "peeker, run the tests again" / "tell bookboy to use Neon" | sends your words to that session, after a 1.5 second preview you can cancel |
| "approve" / "no, use pnpm instead" | answers the permission at the top of the queue; a "no" passes your reason to Claude |
| "Neon" / "the second one" | answers a multiple-choice question, with no arrow keys |
| "catch me up" / "what's synqed doing?" | says what changed since you last looked |
| "trust it" | trusts a new folder for the session asking |
| "go to whisker" / "stop synqed" / "close peeker" / "bring back peeker" | focus, interrupt, close and resume |
| "rename synqed to synqed auth" | renames a session, open or closed, so two in one folder are easy to tell apart |
| "what did api change?" | names the files api changed in its last task, with line counts |
| "be quiet" / "mute" / "talk to me" | announcements for questions and permissions only, sounds only, or everything |

Those happen at once on your computer. Everything else goes to the assistant in the middle: Claude (Opus 5.5 at low effort) on the Agent SDK, through your own Claude Code login, so there is no API key to set up. Ask it anything ("what is everyone doing?", "what changed in heyterm today?", "start a session in portfolio and fix the header") and it answers out loud, reads sessions, sends them work and runs commands on your Mac. It does whatever your Claude Code permission mode allows, and asks you out loud whenever Claude Code would ask. When a session needs you, the assistant tells you what it wants and what to say, in plain words, without reading the command out.

HeyTerm speaks with your Mac's own voice (whatever is set in System Settings, Accessibility, Spoken Content; Siri voices work there), or the browser's voice if you pick it in Setup.

## What you see

- **Sessions on the left**, each with its own face and its state, waits counted while it needs you. The sidebar folds to a rail of faces that are named when you hover.
- **Terminals in the middle**, in a grid or one at a time.
- **The conversation on the right.** When a session needs you, its request arrives as a message there, with buttons and the words to say. Answer by voice or click; your answer shows up as your own message under it. Fold the column away and the most urgent request sits in one slim row above the bar you talk into.
- **Gruvbox, light or dark.** HeyTerm starts in Gruvbox Material light; Setup, Appearance switches to dark or follows your system. Terminals stay dark in both, because coding agents colour their text for a dark terminal.

## Getting started

To see it without installing anything, open the [playground](https://heyterm.vercel.app/playground/): the same interface on three simulated agents.


You need Node.js 20 or newer on macOS, Linux or Windows, and at least one coding agent signed in once: [Claude Code](https://code.claude.com), [Codex](https://github.com/openai/codex) (`npm install -g @openai/codex`), [Gemini CLI](https://github.com/google-gemini/gemini-cli) (`npm install -g @google/gemini-cli`), Grok Build (`curl -fsSL https://x.ai/cli/install.sh | bash`, then `grok login`) or Cursor (`curl https://cursor.com/install -fsS | bash`, then `cursor-agent login`). The assistant in the middle runs on Claude Code.

```bash
npx heyterm doctor    # checks Node and which agents are installed
npx heyterm           # starts HeyTerm and opens it in your browser
```

To run it from source instead:

```bash
git clone https://github.com/adilhusain01/heyterm && cd heyterm
npm install && npm run build
node bin/heyterm.js
```

Then:

1. Click anywhere on the page once, so the browser lets HeyTerm speak.
2. Open Setup and check your project folders. HeyTerm looks in `~/Documents/Projects`, `~/Projects`, `~/code`, `~/dev`, `~/src` and `~/Developer` by default, and the assistant can start a session in any folder you name.
3. Hold your dictation key (Fn for Wispr Flow) and say "start a session in" followed by a project name. Say "start a codex session in…", "open gemini in…", "start a grok session in…" or "open cursor in…" for the other agents.
4. Use headphones, so HeyTerm's spoken alerts never end up in your own dictation.

To see the Claude sessions you start in your own terminals as well, open Setup and press **Show them** under Your own Claude sessions. While HeyTerm runs, its hooks sit in `~/.claude/settings.json` (backed up first in `~/.heyterm/backups`); they come out when HeyTerm stops. It can answer those sessions' permissions and questions and tell you when they finish, but it can only type into sessions it started.

## Starting, stopping and removing it

| | |
| --- | --- |
| `heyterm` | starts it and opens the page, or opens the one already running |
| `heyterm stop`, Ctrl+C, Quit in Setup, or closing the last HeyTerm page | stops it and every session in it; they wait under Recently closed, and Bring back resumes the conversation |
| `heyterm uninstall` | stops it, takes its hooks out of your Claude settings and moves `~/.heyterm` to the Trash; then `npm uninstall -g heyterm` removes the command |

Closing the page stops HeyTerm after 15 seconds, so a reload never does. Setup has **Keep running without the page** if you want it to stay up.

## How it works

- **Sessions run in HeyTerm's own terminals** (pseudo-terminals it owns, the same on macOS, Linux and Windows), with a copy of each screen so the assistant can read it and a page opened later sees it.
- **Agent hooks report every state**, so nothing is guessed from the screen. Claude Code gets them through a settings file for its session; Codex through config overrides for that run (Codex asks once to trust them; say "trust it"). Your own `~/.codex` and Claude settings are not changed.
- **Grok Build and Cursor read hooks only from global files**, so while HeyTerm runs it writes `~/.grok/hooks/heyterm.json` and adds its entries to `~/.cursor/hooks.json` (backed up first), and takes them out again when it stops or is uninstalled. They only report what happens; nothing in them can approve or block a tool, so each agent's own permission rules stay in charge, and sessions HeyTerm did not start are ignored. Grok's permission card shows as waiting in its terminal: say "go to" the session and answer there.
- **A permission or a multiple-choice question is held open until you answer by voice**; answering in the terminal by hand still works, and wins.
- **No extra gates**: HeyTerm adds no permission layer of its own. What an agent's permission mode allows, it runs; when the agent asks, you hear what it wants and its risk, and "approve" answers.
- **Text is sent as a real prompt**, pasted into the session and confirmed by its prompt hook.
- **Announcements wait for you.** Nothing is spoken while text is arriving in the command bar, lines are said one after another, and what you say goes ahead of news waiting for the assistant.

## Privacy and safety

- The server listens on `127.0.0.1` only. It refuses requests from other sites, and every hook and every page connection needs a private token from `~/.heyterm/token` (readable by you alone), so neither a web page nor another user on the same computer can type into your terminals.
- Every decision, by voice or click, goes into `~/.heyterm/audit.jsonl` with the time, the session, the command and the words that decided it.
- HeyTerm never deletes a folder or a worktree. Closing a session that is working or has uncommitted changes asks first.

## Settings

All optional; see `.env.example`.

| Variable | What it changes |
| --- | --- |
| `HEYTERM_PORT` | the port (default 4747) |
| `HEYTERM_PROJECT_ROOTS` | project folders, separated by `:` (`;` on Windows); Setup saves the same thing |
| `HEYTERM_ROUTER_MODEL` | the assistant's model (default `claude-opus-5-5`) |
| `ANTHROPIC_API_KEY` | run the assistant on the Claude API instead of your Claude Code login |

## Development

```bash
npm install
npm run dev        # server with reload on :4747, UI with reload on :5173
npm test           # the unit tests; CI also runs them on macOS, Linux and Windows
npm run typecheck
npm run build      # dist/web and dist/server/cli.js
npm run build:playground   # dist/playground: the same UI on three simulated agents, a static site anyone can open
npm run dev:site           # the landing page (site/) with reload on :5174
npm run build:site         # dist/site: the landing page, with the playground under /playground/
npm run deploy:site        # builds both and deploys them to Vercel as one site
```

The landing page lives in `site/`. It shares the app's tokens (`src/web/tokens.css`) and motion (`src/web/motion.css`), so the two never drift apart, and its hero is a small HeyTerm running a scene. The faces it shows are drawn at build time by `scripts/site-faces.mjs`, so the page ships pictures instead of the face generator.

`docs/SPEC.md` is the behaviour HeyTerm promises, and the tests are written from it. `scripts/smoke.mjs` checks an installed package end to end (start, the token wall, stop, uninstall). Pure decisions (routing, risk, session states, the attention queue) live in their own files with tests beside them.

Built for [No Hands: The Wispr Challenge](https://www.wemakedevs.org/wispr) by WeMakeDevs and Wispr Flow.

The look is specified in `docs/DESIGN.md`.

## Licence

MIT, see `LICENSE`. The packages HeyTerm ships keep their own licences, listed in `THIRD_PARTY_NOTICES.md`.
