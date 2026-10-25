# HeyTerm design kit

HeyTerm is a console you mostly listen to. The screen has to answer three questions at a glance: what needs me, what is the assistant doing, and what is each session doing. Everything here serves those three. The rules come from Adil's design taste notes; the component ideas come from the libraries catalogued in his vault, redrawn on these tokens instead of installed.

## Principles

- **Press it or read it.** A key casts a shadow and can be pressed. A tray sits in and holds things. A sheet is flat and is only read. Nothing else.
- **One palette, two themes.** HeyTerm uses Gruvbox Material, the palette of Adil's Obsidian theme: light (cream and brown) by default, dark (warm charcoal and sand) in Setup, or whichever the system uses. One accent, Gruvbox orange, marks focus, selection, links and headings. Every other saturated colour means a session state and nothing else: blue working, orange needs a permission or trust, plum asked a question, red failed, olive done.
- **Terminals stay dark.** In both themes a terminal uses Gruvbox Material dark. Agent CLIs pick their own text colours for a dark terminal, and on a light one some of their text would disappear.
- **Say it once.** A session's name, state and wait show once per place. A long command folds to four lines.
- **Motion explains.** Something enters, something is pressed, a state changes. Under 300ms, ease-out, transforms and opacity only, and a cross-fade under reduced motion. Loops (the orb, a spinner) only while something is actually happening.

## Tokens

All live in `src/web/styles.css` under `@theme`, and every component takes its values from there.

| Group | Tokens | Notes |
|---|---|---|
| Surfaces | `canvas`, `tray`, `panel`, `raised`, `key`, `key-hover`, `terminal`, `scrim` | Canvas is the working area and panel the sidebars, as in Obsidian. Tray sits in; keys stand out. `terminal` is the same dark in both themes. |
| Lines | `line`, `line-strong` | Hairlines between groups. Panels never get a shadow. |
| Ink | `ink`, `ink-muted`, `ink-faint` | Body text, secondary text, hints. Muted keeps 4.5:1 contrast on every surface, faint at least 3:1 (times and hints only). |
| Accent | `accent`, `accent-ink`, `primary`, `primary-hover`, `primary-ink` | `accent` for rings and marks, `accent-ink` where the accent is text. The primary key is the darkest ink in light and the lightest sand in dark. |
| Outlines | `image-outline` | A neutral 1px line around faces, never tinted. |
| States | `working`, `permission`, `question`, `trust`, `failed`, `finished`, `idle` | Only for session state. |
| Radii | `outer` 12, `inner` 8, `small` 6, `tiny` 4, `mark` 3 | Concentric: an inner radius is the outer one minus the padding between them, so a key in a tray with 2px padding is `small`. A face's corner is 24% of its size. |
| Type | `micro` 11, `small` 12.5, `meta` 13, `body` 15, `title` 16, `display` 22 | One scale, no one-off sizes. `micro` is only for the wait under a face in the rail. |
| Shadows | `shadow-key`, `shadow-key-hover`, `shadow-tray` | Only keys cast one: a soft drop shadow tinted with the ink, and no highlight line along the top edge (Adil disliked the bevel it made). The recipe follows Aceternity's "Next.js White" button. Cards, labels and toasts sit flat with a border. |
| Motion | `ease-out`, `ease-in-out`, `duration-press` 120, `duration-enter` 200, `duration-state` 240 | |

## Components (`src/web/ui/`)

| Component | What it is | Drawn from |
|---|---|---|
| `Key` | A pressable button: `primary`, `plain`, `quiet` (no shadow, for rows). Presses to 0.96, lifts 1px on hover with a fine pointer. | Design taste, keys |
| `Segmented` | A choice of a few options: a tray with the chosen one raised as a key. Used for the theme, the voice and the agent of a new session. | |
| `Sheet`, `Tray` | The two non-pressable surfaces. | Design taste, sheets and trays |
| `StateMark` | A session's state as one glyph: a hollow ring when idle, a turning arc when working, a filled square when it needs you, a check when done, a cross when failed. | React Bits Status Mark |
| `AssistantOrb` | The assistant's face: a round matrix of dots. Still when idle, a ripple outward while thinking, a pulse while speaking, bright while it hears you, dim when it cannot hear you. | Rare UI Matrix Orb |
| `StatusLine` | One line saying what the assistant is doing, which swaps as it moves on. | transitions.dev Thinking states, Rare UI Inline AI Status |
| `FoldedText` | A command or path shown in a tray, folded to four lines with a key to open it. | Design taste, decluttering |
| `Hint` | What to say out loud, in the faint ink, with the spoken words in quotes. | |
| `Kbd` | A key cap for keyboard hints. | |
| `SessionAvatar` | Each session's own face: a DiceBear Adventurer drawn from its name, on a pastel tile coloured from the same name, with the state as a badge. The style is CC BY 4.0 by Lisa Wischofsky, credited in THIRD_PARTY_NOTICES.md. | [DiceBear](https://www.dicebear.com/styles/adventurer/) |
| `HelpTip` | A "?" beside a heading that opens a short card explaining it, drawn above everything and kept on screen. Headings stay one word or two. | |
| `RailLabel` | The name beside a face or icon in the folded sidebar: the first after 300ms, its neighbours at once. | |
| `Markdown` | What agents write, rendered from Markdown with no raw HTML, so nothing an agent writes can run in the page. Headings and links in the accent, as in Obsidian. | react-markdown |
| `icons` | Lucide icons fetched with better-icons from Iconify and kept as source; 1.75px stroke, the same set and weight Obsidian uses. | Lucide via better-icons |

Request parts live in `src/web/components/AttentionCard.tsx`: the `chat` card in the conversation, the slim `bar` row above the bar you talk into, and the `banner` on the asking pane. All three share the same keys and the same spoken hint.

## Layout

- Every surface floats: the sidebar, the terminals, the bar and the conversation sit 8px in from the page edges and from each other, each with the 12px outer radius, so the page reads as one set of panels on the canvas. On a phone the sidebar runs edge to edge above the terminals.
- No top bar. The left sidebar holds the name, every session with its face, Recently closed, today's numbers, the sound mode and Setup.
- It folds to a 60px rail of session faces. A waiting face keeps its wait under it, recently closed sessions sit faded below a rule and come back on a click, and every face and icon is named beside it on hover (`RailLabel`: the first after 300ms, its neighbours at once). The sound mode and Setup sit under a rule at the bottom, as in the open sidebar.
- Centre: the terminals, in a grid whose columns follow the width (each at least 440px; past two rows the grid scrolls instead of shrinking). There is no toolbar above them. A pane's expand key shows that session alone and its shrink key brings the grid back; while one is shown alone, picking another in the sidebar switches to it. With a single session the key is not drawn, since there is nothing to switch between.
- Right: the conversation with the assistant, with a status line at the top saying what it is doing. The orb is drawn once, in the bar you talk into; the header does not repeat it. The sidebar header, the first row of panes and the conversation header share one 48px top edge. A session's request is a message in it, in the order it arrived, and can be answered right there. An answer, said or clicked, follows it as your own message, and the request settles into a quiet "Answered" line. A request older than the kept lines still appears at the end. Your words and new requests bring the list to the end; anything else that arrives while you read further up shows a "New messages" key instead of moving the page. Each asking session also shows a slim banner on its own pane.
- The column folds away; a key at the end of the bar brings it back. While it is folded, the screen is under 1024px, or in the playground, the most urgent request sits in one slim row above the bar you talk into: face, name, what it wants, the folder or command in faint mono, and its keys, with any others as faces to switch to.
- Under the terminals: the bar you talk into, with the orb at its left showing whether it hears you. It belongs to the centre column, so it is exactly as wide as the terminals and shares their gutters, and the conversation column runs the full height beside it.
- Explanations live behind "?" cards, not in paragraphs under headings.

Below 1024px wide the conversation folds into the line above the bar; below 768px everything is one column, the sidebar takes at most 45% of the height and never folds to the rail. Nothing scrolls sideways at 360 or 390 wide.

Paths are shown by their end (`…/projects/docs`), since that is what names the folder, with the full path on hover.
