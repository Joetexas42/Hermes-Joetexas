"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `fn` immediately, then on `intervalMs` — but pauses while the tab is
 * hidden so background tabs don't fork CLI processes every few seconds.
 */
export function usePollWhileVisible(fn: () => void | Promise<void>, intervalMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      fnRef.current();
      timer = setInterval(() => fnRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer !== null) { clearInterval(timer); timer = null; }
    };

    const onVisibility = () => {
      if (document.hidden) stop(); else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
