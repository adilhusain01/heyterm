# Callsign design kit

Callsign is a console you mostly listen to. The screen has to answer three questions at a glance: what needs me, what is the assistant doing, and what is each session doing. Everything here serves those three. The rules come from Adil's design taste notes; the component ideas come from the libraries catalogued in his vault, redrawn on these tokens instead of installed.

## Principles

- **Press it or read it.** A key casts a shadow and can be pressed. A tray sits in and holds things. A sheet is flat and is only read. Nothing else.
- **Ink is the only accent.** Colour means a session state and nothing else: blue working, amber needs a permission or trust, violet asked a question, red failed, green done. The assistant is drawn in ink.
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

## Layout

- Top bar: the name, then today's numbers in trays, then the sound mode and Setup as keys.
- Left rail: the one thing that needs you most as a sheet with an edge in its state colour, then every session as a row with its state mark, then new session and recently closed.
- Centre: the terminals.
- Right: the conversation with the assistant, its orb and status line at the top.
- Bottom: the bar you talk into, with the orb at its left showing whether it hears you.

Below 1024px wide the conversation column folds into the line above the bar, and below 768px everything is one column.
