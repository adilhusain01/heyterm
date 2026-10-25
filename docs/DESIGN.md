# HeyTerm design kit

HeyTerm is a console you mostly listen to. The screen has to answer three questions at a glance: what needs me, what is the assistant doing, and what is each session doing. Everything here serves those three. The rules come from Adil's design taste notes; the component ideas come from the libraries catalogued in his vault, redrawn on these tokens instead of installed.

## Principles

- **Press it or read it.** A key casts a shadow and can be pressed. A tray sits in and holds things. A sheet is flat and is only read. Nothing else.
- **Ink is the only accent.** Saturated colour means a session state and nothing else: blue working, amber needs a permission or trust, violet asked a question, red failed, green done. Session faces use soft, muted tints so they never compete with state. The assistant is drawn in ink.
- **Say it once.** A session's name, state and wait show once per place. A long command folds to four lines.
- **Motion explains.** Something enters, something is pressed, a state changes. Under 300ms, ease-out, transforms and opacity only, and a cross-fade under reduced motion. Loops (the orb, a spinner) only while something is actually happening.

## Tokens

All live in `src/web/styles.css` under `@theme`, and every component takes its values from there.

| Group | Tokens | Notes |
|---|---|---|
| Surfaces | `canvas`, `tray`, `panel`, `raised`, `key`, `key-hover` | Tray is darker than the panel it sits in; keys are lighter. |
| Lines | `line`, `line-strong` | Hairlines between groups. Panels never get a shadow. |
| Ink | `ink`, `ink-muted`, `ink-faint` | Body text, secondary text, hints. |
| States | `working`, `permission`, `question`, `trust`, `failed`, `finished`, `idle` | Only for session state. |
| Radii | `outer` 12, `inner` 8, `mark` 3 | Concentric: an inner radius is the outer one minus the 4px between them. |
| Type | `text-meta` 13, `text-body` 15, `text-title` 16 | Nothing reads below 13px. Terminals keep their own size. |
| Shadows | `shadow-key`, `shadow-key-hover`, `shadow-tray` | Only keys cast one. |
| Motion | `ease-out`, `ease-in-out`, `duration-press` 120, `duration-enter` 200, `duration-state` 240 | |

## Components (`src/web/ui/`)

| Component | What it is | Drawn from |
|---|---|---|
| `Key` | A pressable button: `primary` (ink), `plain`, `quiet` (no shadow, for rows). Presses to 0.97, lifts 1px on hover with a fine pointer. | Design taste, keys |
| `Sheet`, `Tray` | The two non-pressable surfaces. | Design taste, sheets and trays |
| `StateMark` | A session's state as one glyph: a hollow ring when idle, a turning arc when working, a filled square when it needs you, a check when done, a cross when failed. | React Bits Status Mark |
| `AssistantOrb` | The assistant's face: a round matrix of dots. Still when idle, a ripple outward while thinking, a pulse while speaking, bright while it hears you, dim when it cannot hear you. | Rare UI Matrix Orb |
| `StatusLine` | One line saying what the assistant is doing, which swaps as it moves on. | transitions.dev Thinking states, Rare UI Inline AI Status |
| `FoldedText` | A command or path shown in a tray, folded to four lines with a key to open it. | Design taste, decluttering |
| `Hint` | What to say out loud, in the faint ink, with the spoken words in quotes. | |
| `Kbd` | A key cap for keyboard hints. | |
| `SessionAvatar` | Each session's own face: a DiceBear Adventurer drawn from its name, on a pastel tile coloured from the same name, with the state as a badge. The style is CC BY 4.0 by Lisa Wischofsky, credited in THIRD_PARTY_NOTICES.md. | [DiceBear](https://www.dicebear.com/styles/adventurer/) |
| `HelpTip` | A "?" beside a heading that opens a short card explaining it, drawn above everything and kept on screen. Headings stay one word or two. | |
| `Markdown` | What agents write, rendered from Markdown with no raw HTML, so nothing an agent writes can run in the page. | react-markdown |
| `icons` | Lucide icons fetched with better-icons from Iconify and kept as source; 1.75px stroke. | Lucide via better-icons |

## Layout

- No top bar. The left sidebar holds the name, every session with its face, Recently closed, today's numbers, the sound mode and Setup.
- It folds to a 60px rail of session faces. A waiting face keeps its wait under it, recently closed sessions sit faded below a rule and come back on a click, and every face and icon is named beside it on hover (`RailLabel`: the first after 300ms, its neighbours at once). The sound mode and Setup sit under a rule at the bottom, as in the open sidebar.
- Centre: the terminals, in a grid whose columns follow the width (each at least 440px; past two rows the grid scrolls instead of shrinking), or one at a time with tabs to switch. A pane's expand key switches to one at a time.
- Right: the conversation with the assistant, its orb and status line at the top. Requests pin under that header, above the conversation: the most urgent one with the others as faces to switch to. Each asking session also shows a slim banner on its own pane. The column folds away; a key in the terminal toolbar brings it back, and while it is folded (or the screen is under 1024px, or in the playground) the requests dock above the bar you talk into instead.
- Bottom: the bar you talk into, with the orb at its left showing whether it hears you.
- Explanations live behind "?" cards, not in paragraphs under headings.

Below 1024px wide the conversation folds into the line above the bar; below 768px everything is one column and the sidebar takes at most 45% of the height.
