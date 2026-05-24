/**
 * Supported locales. Codes follow ISO 639 where possible:
 *  - en  English
 *  - yo  Yoruba
 *  - ig  Igbo
 *  - ha  Hausa
 *  - pcm Nigerian Pidgin (ISO 639-3)
 */
export const LOCALES = ['en', 'yo', 'ig', 'ha', 'pcm'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_COOKIE = 'nbt-locale';

/** Native + English names + a glyph shown in the language switcher. */
export const LOCALE_META: Record<Locale, { native: string; english: string; abbr: string }> = {
  en:  { native: 'English',     english: 'English',           abbr: 'EN'  },
  yo:  { native: 'Yorùbá',      english: 'Yoruba',            abbr: 'YO'  },
  ig:  { native: 'Asụsụ Igbo',  english: 'Igbo',              abbr: 'IG'  },
  ha:  { native: 'Hausa',       english: 'Hausa',             abbr: 'HA'  },
  pcm: { native: 'Naija',       english: 'Nigerian Pidgin',   abbr: 'PCM' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Pick the best supported locale for an Accept-Language header. */
export function negotiate(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const requested = acceptLanguage
    .split(',')
    .map((tag) => tag.split(';')[0].trim().toLowerCase())
    .filter(Boolean);
  for (const tag of requested) {
    const primary = tag.split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
