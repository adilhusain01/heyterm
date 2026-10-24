// A record of how text reaches the page (event kinds, lengths, which element had focus), never the
// words themselves. It shows whether a dictation tool's text arrives, and where, when it seems lost.

import type { FocusedElement } from "./listening-state.ts";

export interface InputRecord {
  at: number;
  type: string;
  inputType?: string;
  length?: number;
  key?: string;
  target: FocusedElement;
  windowHasFocus: boolean;
}

interface EventFacts {
  type: string;
  inputType?: string;
  data?: string | null;
  key?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

export class InputDiagnostics {
  static describe(event: EventFacts, where: { target: FocusedElement; windowHasFocus: boolean; at: number }): InputRecord {
    const record: InputRecord = { at: where.at, type: event.type, target: where.target, windowHasFocus: where.windowHasFocus };
    if (event.inputType) record.inputType = event.inputType;
    if (typeof event.data === "string") record.length = event.data.length;
    const key = describedKey(event);
    if (key) record.key = key;
    return record;
  }
}

// A plain character is left out; a named key or a shortcut is kept.
function describedKey(event: EventFacts): string | undefined {
  if (!event.key) return undefined;
  const modifiers = [event.metaKey ? "Meta" : "", event.ctrlKey ? "Control" : "", event.altKey ? "Alt" : ""].filter(Boolean);
  if (event.key.length > 1) return [...modifiers, event.key].join("+");
  return modifiers.length > 0 ? [...modifiers, event.key].join("+") : undefined;
}

// Watches every way text can reach the page and sends the records to Callsign in small batches.
export function watchInput(barElement: () => HTMLInputElement | null, send: (records: InputRecord[]) => void): () => void {
  let batch: InputRecord[] = [];
  const where = () => ({ target: focusedElementKind(barElement()), windowHasFocus: document.hasFocus(), at: Date.now() });
  const onEvent = (event: Event) => {
    const facts: EventFacts = { type: event.type };
    if (event instanceof InputEvent) {
      facts.inputType = event.inputType;
      facts.data = event.data;
    }
    if (event instanceof ClipboardEvent) facts.data = event.clipboardData?.getData("text/plain") ?? null;
    if (event instanceof KeyboardEvent) Object.assign(facts, { key: event.key, metaKey: event.metaKey, ctrlKey: event.ctrlKey, altKey: event.altKey });
    batch.push(InputDiagnostics.describe(facts, where()));
  };
  const documentEvents = ["beforeinput", "input", "paste", "keydown", "compositionstart", "compositionend", "focusin"];
  for (const name of documentEvents) document.addEventListener(name, onEvent, true);
  const onWindowFocus = (event: Event) => batch.push(InputDiagnostics.describe({ type: `window-${event.type}` }, where()));
  window.addEventListener("focus", onWindowFocus);
  window.addEventListener("blur", onWindowFocus);
  const timer = window.setInterval(() => {
    if (batch.length === 0) return;
    send(batch);
    batch = [];
  }, 2_000);
  return () => {
    for (const name of documentEvents) document.removeEventListener(name, onEvent, true);
    window.removeEventListener("focus", onWindowFocus);
    window.removeEventListener("blur", onWindowFocus);
    window.clearInterval(timer);
  };
}

function focusedElementKind(bar: HTMLInputElement | null): FocusedElement {
  const active = document.activeElement;
  if (active && active === bar) return "bar";
  if (active?.closest(".xterm")) return "terminal";
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return "other_field";
  return "nothing";
}
