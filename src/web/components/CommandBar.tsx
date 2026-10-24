// The one input Wispr (or any dictation tool) types into. It keeps focus, sends dictation by itself
// after a short quiet, and shows what Callsign is about to do with it.

import { useEffect, useRef, useState } from "react";
import { useCallsign } from "../app-context.tsx";
import { DictationDetector } from "../dictation-detector.ts";
import { useCallsignStore } from "../state/callsign-store.ts";
import { MicrophoneIcon } from "./icons.tsx";
import { PendingStrip } from "./PendingStrip.tsx";

export function CommandBar() {
  const { sendUtterance, perform, announcer } = useCallsign();
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

  return (
    <footer className="shrink-0 border-t border-line bg-panel p-2">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-1.5">
        <PendingStrip control={control} />
        {typingSession && (
          <button type="button" onClick={() => setTypingSession(undefined)} className="cursor-pointer rounded-inner border border-line bg-raised px-3 py-1.5 text-left text-[12px] text-ink-muted">
            Typing into <span className="font-mono text-ink">{typingSession}</span>. Click here to talk to Callsign again.
          </button>
        )}
        <label className="flex h-12 items-center gap-3 rounded-outer border border-line-strong bg-canvas px-3 focus-within:border-ink/50">
          <MicrophoneIcon size={18} className="shrink-0 text-ink-muted" />
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
            placeholder={'Speak with Wispr Flow or any dictation tool. Try "catch me up"'}
            aria-label="Talk to Callsign"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden shrink-0 rounded-mark border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-faint sm:block">Enter</kbd>
        </label>
      </div>
    </footer>
  );
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
