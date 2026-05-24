import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale, isLocale, negotiate } from './config';

import en from './messages/en.json';
import yo from './messages/yo.json';
import ig from './messages/ig.json';
import ha from './messages/ha.json';
import pcm from './messages/pcm.json';

type Messages = Record<string, string>;

const BUNDLES: Record<Locale, Messages> = {
  en: en as Messages,
  yo: yo as Messages,
  ig: ig as Messages,
  ha: ha as Messages,
  pcm: pcm as Messages,
};

/** Server-side locale resolution: cookie → Accept-Language → default. */
export function getLocale(): Locale {
  const fromCookie = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return negotiate(headers().get('accept-language'));
}

/**
 * Translator factory. Use in server components/pages:
 *   const t = getT();
 *   <h1>{t('home.hero.title')}</h1>
 *
 * Missing keys fall back to the English message, then to the key itself, so partial translations
 * don't break the page.
 */
export function getT(locale?: Locale) {
  const lang = locale ?? getLocale();
  const primary = BUNDLES[lang];
  const fallback = BUNDLES.en;
  return function t(key: string, vars?: Record<string, string | number>): string {
    const raw = primary[key] ?? fallback[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
  };
}

/** Returns the active locale and the full message bundle merged over English fallback. */
export function getMessageBundle(locale?: Locale): { locale: Locale; messages: Messages } {
  const lang = locale ?? getLocale();
  return { locale: lang, messages: { ...BUNDLES.en, ...BUNDLES[lang] } };
}
