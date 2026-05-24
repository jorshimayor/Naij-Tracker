import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { LOCALES, LOCALE_COOKIE, LOCALE_META, type Locale } from '@/i18n/config';

async function setLocaleAction(formData: FormData) {
  'use server';
  const locale = String(formData.get('locale') ?? '') as Locale;
  if (!LOCALES.includes(locale)) return;
  cookies().set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}

interface Props {
  current: Locale;
  /** Optional label for the trigger when no label needed beyond the locale glyph. */
  label?: string;
}

/**
 * Language switcher — server component, uses <details> for a JS-free dropdown.
 * Each option is a form that POSTs to setLocaleAction. On select, the cookie is set and the
 * layout revalidates so the entire page re-renders in the new locale.
 */
export function LangSwitcher({ current }: Props) {
  const currentMeta = LOCALE_META[current];
  return (
    <details className="relative">
      <summary
        aria-label={`Language: ${currentMeta.english}. Click to switch.`}
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 font-display text-[11px] uppercase tracking-roman text-foreground/85 transition-colors hover:border-gold hover:text-gold [&::-webkit-details-marker]:hidden"
      >
        <GlobeIcon />
        <span className="hidden sm:inline">{currentMeta.abbr}</span>
        <ChevronIcon />
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-md border border-border bg-card p-1.5 shadow-lg">
        <div className="px-3 pb-2 pt-2">
          <div className="roman-eyebrow text-[10px]">Language</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Choose your reading language</div>
        </div>
        <div className="h-px bg-border" />
        <div className="mt-1 flex flex-col">
          {LOCALES.map((l) => {
            const meta = LOCALE_META[l];
            const isActive = l === current;
            return (
              <form key={l} action={setLocaleAction}>
                <input type="hidden" name="locale" value={l} />
                <button
                  type="submit"
                  aria-current={isActive ? 'true' : undefined}
                  className={`group flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'bg-gold/10 text-foreground'
                      : 'text-foreground/85 hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <div>
                    <div className="font-serif text-base leading-none">{meta.native}</div>
                    <div className="mt-1 font-display text-[10px] uppercase tracking-roman text-muted-foreground">
                      {meta.english}
                    </div>
                  </div>
                  <span
                    className={`font-display text-[10px] uppercase tracking-roman ${
                      isActive ? 'text-gold' : 'text-muted-foreground group-hover:text-foreground/60'
                    }`}
                  >
                    {isActive ? '✦' : meta.abbr}
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2.5 3 2.5 11 0 14M10 3c-2.5 3-2.5 11 0 14" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}
