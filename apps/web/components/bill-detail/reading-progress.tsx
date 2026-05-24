'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Stable key for localStorage — typically the bill id. */
  storageKey: string;
}

/**
 * Sticky 2px gold progress bar at the top of the reader. Also persists the reader's scroll
 * position to localStorage so a returning visitor lands at the same paragraph.
 *
 * Listening is throttled with requestAnimationFrame so long scrolls stay smooth.
 */
export function ReadingProgress({ storageKey }: Props) {
  const [percent, setPercent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastSavedRef = useRef(0);

  useEffect(() => {
    const key = `nbt-read-pos:${storageKey}`;

    // Restore scroll on mount.
    const saved = Number(localStorage.getItem(key) ?? '0');
    if (saved > 0 && saved < document.documentElement.scrollHeight) {
      // Defer to next tick so layout has settled.
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved, behavior: 'auto' });
      });
    }

    const tick = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      const pct = docH > 0 ? Math.min(100, Math.max(0, (y / docH) * 100)) : 0;
      setPercent(pct);
      // Save at most once per second to avoid hammering localStorage.
      const now = performance.now();
      if (now - lastSavedRef.current > 1000) {
        lastSavedRef.current = now;
        try { localStorage.setItem(key, String(Math.round(y))); } catch {}
      }
    };

    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        tick();
      });
    };

    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      // Persist final position on unmount.
      try { localStorage.setItem(key, String(Math.round(window.scrollY))); } catch {}
    };
  }, [storageKey]);

  return (
    <div
      aria-hidden
      className="fixed left-0 right-0 top-0 z-40 h-[2px] bg-transparent"
    >
      <div
        className="h-full bg-gold transition-[width] duration-150 ease-out"
        style={{ width: `${percent}%`, boxShadow: '0 0 8px hsl(var(--gold) / 0.6)' }}
      />
    </div>
  );
}
