// The server's current time, ticking once a second, for wait timers.

import { useEffect, useState } from "react";
import { useHeyTermStore } from "./heyterm-store.ts";

export function useServerNow(): number {
  const offset = useHeyTermStore((state) => state.serverClockOffset);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now + offset;
}
