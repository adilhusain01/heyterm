// The one input Wispr (or any dictation tool) types into. It keeps focus, sends dictation by itself
// after a short quiet, and shows what Callsign is about to do with it.

import { useEffect, useRef, useState } from "react";
import { useCallsign } from "../app-context.tsx";
import { DictationDetector } from "../dictation-detector.ts";
import { watchInput } from "../input-diagnostics.ts";
import { PasteInsertion } from "../paste-insertion.ts";
import { ListeningState, type Listening } from "../listening-state.ts";
import { useCallsignStore } from "../state/callsign-store.ts";
import { useOrbState } from "../state/use-orb-state.ts";
import { AssistantOrb } from "../ui/AssistantOrb.tsx";
import { Kbd } from "../ui/Hint.tsx";
import { PendingStrip } from "./PendingStrip.tsx";

export function CommandBar() {
  const { sendUtterance, perform, announcer, connection } = useCallsign();
  const typingSession = useCallsignStore((state) => state.typingSession);
  const setTypingSession = useCallsignStore((state) => state.setTypingSession);
  const control = useCallsignStore((state) => state.control);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const detector = useRef(new DictationDetector());
  const textRef = useRef(text);
  textRef.current = text;

  const submit = (source: "voice" | "keyboard") => {
    const utterance = textRef.current.trim();
    detector.current.reset();
    setText("");
    if (utterance) sendUtterance(utterance, source);
  };

  // Dictation goes out by itself once it has been quiet for a moment.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (detector.current.shouldSubmit(Date.now())) submit("voice");
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useKeepFocus(inputRef, typingSession === undefined);
  const listening = useListening(inputRef);
  useEffect(() => watchInput(() => inputRef.current, (records) => connection.send({ type: "input_diagnostics", records: records as unknown as Array<Record<string, unknown>> })), [connection]);
  const orbState = useOrbState();
  const setBarState = useCallsignStore((state) => state.setBarState);
  useEffect(() => setBarState({ listening }), [listening, setBarState]);
  useEffect(() => setBarState({ barHasText: text.trim().length > 0 }), [text, setBarState]);

  // Dictation arrives as a paste. The bar inserts it itself, at the cursor, so nothing else in the
  // browser can cancel it, and a paste with no field focused lands here too.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const bar = inputRef.current;
      const focused = ListeningState.focusedElement(document.activeElement, bar);
      if (!bar || !ListeningState.pasteBelongsToBar(focused)) return;
      const pasted = event.clipboardData?.getData("text/plain") ?? "";
      if (!pasted.trim()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const current = textRef.current;
      const selection = focused === "bar" ? { start: bar.selectionStart ?? current.length, end: bar.selectionEnd ?? current.length } : { start: current.length, end: current.length };
      const { text: next, caret } = PasteInsertion.apply(current, selection, pasted);
      detector.current.recordChange(current, next, Date.now());
      announcer.noteInputActivity();
      setText(next);
      bar.focus();
      requestAnimationFrame(() => bar.setSelectionRange(caret, caret));
    };
    // Capture, so this runs before any other paste handler on the page.
    document.addEventListener("paste", onPaste, true);
    return () => document.removeEventListener("paste", onPaste, true);
  }, [announcer]);

  return (
    <footer className="shrink-0 border-t border-line bg-panel px-2 pt-2 pb-2.5">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-1.5">
        <PendingStrip control={control} />
        {typingSession && (
          <button type="button" onClick={() => setTypingSession(undefined)} className="cursor-pointer rounded-inner border border-line bg-raised px-3 py-1.5 text-left text-meta text-ink-muted hover:text-ink">
            Typing into <span className="font-mono text-ink">{typingSession}</span>. Click here to talk to Callsign again.
          </button>
        )}
        {!typingSession && listening !== "listening" && listening !== "typing_in_terminal" && (
          <button type="button" onClick={() => inputRef.current?.focus()} className="enter-rise cursor-pointer rounded-inner border border-permission/40 bg-permission/10 px-3 py-1.5 text-left text-meta text-permission">
            {notListeningText[listening]}
          </button>
        )}
        <label
          className={`flex h-13 items-center gap-3 rounded-outer border bg-tray pr-2 pl-3.5 shadow-tray transition-colors duration-200 ${orbState === "deaf" ? "border-line" : "border-line-strong focus-within:border-ink/40"}`}
        >
          <AssistantOrb state={orbState} size={26} />
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => {
              detector.current.recordChange(text, event.target.value, Date.now());
              announcer.noteInputActivity();
              setText(event.target.value);
            }}
            onFocus={() => setTypingSession(undefined)}
            onKeyDown={(event) => {
              announcer.unlock();
              if (event.key === "Enter") {
                event.preventDefault();
                submit(detector.current.inputSource === "voice" ? "voice" : "keyboard");
              }
              if (event.key === "Escape") {
                if (control.preview || control.confirmation || control.clarify) perform({ type: "cancel" });
                detector.current.reset();
                setText("");
              }
            }}
            placeholder={'Talk to Callsign. Hold your dictation key and try "what is everyone doing?"'}
            aria-label="Talk to Callsign"
            className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="hidden sm:block">
            <Kbd>Enter</Kbd>
          </span>
        </label>
      </div>
    </footer>
  );
}

const notListeningText: Record<Exclude<Listening, "listening" | "typing_in_terminal">, string> = {
  window_in_background: "Not listening: another app is in front, so dictation goes there. Bring this window forward to talk.",
  not_listening: "Not listening. Click here, then speak.",
};

// Follows whether dictation would land in the bar: the window must be in front and the bar must have the cursor.
function useListening(inputRef: React.RefObject<HTMLInputElement | null>): Listening {
  const read = () => ListeningState.of({ windowHasFocus: document.hasFocus(), focusedElement: ListeningState.focusedElement(document.activeElement, inputRef.current) });
  const [listening, setListening] = useState<Listening>("listening");
  useEffect(() => {
    // Focus events fire before activeElement settles, so read on the next tick.
    const update = () => window.setTimeout(() => setListening(read()), 0);
    update();
    const events = ["focusin", "focusout"] as const;
    for (const name of events) document.addEventListener(name, update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      for (const name of events) document.removeEventListener(name, update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);
  return listening;
}

// Brings focus back to the command bar whenever nothing else should have it, so dictation never
// lands in the wrong place.
function useKeepFocus(inputRef: React.RefObject<HTMLInputElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const refocus = () => {
      const active = document.activeElement;
      const anotherFieldHasFocus = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active?.closest(".xterm");
      if (!anotherFieldHasFocus || active === inputRef.current) inputRef.current?.focus();
    };
    refocus();
    const onFocusOut = () => window.setTimeout(refocus, 0);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("focus", refocus);
    return () => {
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("focus", refocus);
    };
  }, [enabled, inputRef]);
}
