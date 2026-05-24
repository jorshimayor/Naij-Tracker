'use client';

import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark' | 'system';

function applyMode(mode: Mode) {
  const isDark =
    mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system');

  useEffect(() => {
    const stored = (localStorage.getItem('nbt-theme') as Mode | null) ?? 'system';
    setMode(stored);
    // Apply on mount in case the inline script missed any edge case.
    applyMode(stored);

    // React to OS preference changes when in system mode.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const current = (localStorage.getItem('nbt-theme') as Mode | null) ?? 'system';
      if (current === 'system') applyMode('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function cycle() {
    const next: Mode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setMode(next);
    localStorage.setItem('nbt-theme', next);
    applyMode(next);
  }

  const label = mode === 'light' ? 'Light mode' : mode === 'dark' ? 'Dark mode' : 'System theme';
  const icon =
    mode === 'light' ? <SunIcon /> :
    mode === 'dark' ? <MoonIcon /> :
    <AutoIcon />;

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${label} · click to switch`}
      aria-label={`Theme: ${label}. Click to switch.`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-flag-green hover:text-foreground"
    >
      {icon}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10 4a1 1 0 011 1v1a1 1 0 11-2 0V5a1 1 0 011-1zm0 10a4 4 0 100-8 4 4 0 000 8zm0 1a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-6-5a1 1 0 011-1h1a1 1 0 010 2H5a1 1 0 01-1-1zm10 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM5.05 5.05a1 1 0 011.41 0l.71.71a1 1 0 01-1.42 1.42l-.7-.71a1 1 0 010-1.42zm8.49 8.49a1 1 0 011.41 0l.71.71a1 1 0 01-1.41 1.41l-.71-.71a1 1 0 010-1.41zM5.05 14.95a1 1 0 010-1.41l.71-.71a1 1 0 011.41 1.41l-.71.71a1 1 0 01-1.41 0zm8.49-8.49a1 1 0 010-1.41l.71-.71a1 1 0 011.41 1.41l-.71.71a1 1 0 01-1.41 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14V4a6 6 0 010 12z" />
    </svg>
  );
}
