'use client';

import { useEffect, useState } from 'react';

const SIZES = [
  { id: 's', label: 'A', size: 17, leading: 1.72 },
  { id: 'm', label: 'A',  size: 19, leading: 1.78 },
  { id: 'l', label: 'A',  size: 22, leading: 1.82 },
] as const;
type SizeId = (typeof SIZES)[number]['id'];

/**
 * Three-step font-size control for the reader. Persists choice via localStorage and a
 * CSS variable on the document root so all `.bill-prose p` etc. respond instantly.
 */
export function ReaderControls() {
  const [size, setSize] = useState<SizeId>('m');

  useEffect(() => {
    const saved = localStorage.getItem('nbt-reader-size');
    if (saved === 's' || saved === 'm' || saved === 'l') setSize(saved);
  }, []);

  useEffect(() => {
    const meta = SIZES.find((s) => s.id === size)!;
    document.documentElement.style.setProperty('--reader-size', `${meta.size}px`);
    document.documentElement.style.setProperty('--reader-leading', `${meta.leading}`);
    localStorage.setItem('nbt-reader-size', size);
  }, [size]);

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
      {SIZES.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setSize(s.id)}
          aria-label={`Text size ${s.id.toUpperCase()}`}
          aria-pressed={size === s.id}
          className={`flex h-7 w-7 items-center justify-center rounded-full font-serif transition-colors ${
            size === s.id ? 'bg-gold/15 text-gold' : 'text-muted-foreground hover:text-foreground'
          }`}
          style={{ fontSize: `${10 + i * 3}px` }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
