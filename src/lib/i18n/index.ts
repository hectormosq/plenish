import { es } from './es';
import type { MessageKey } from './es';
import { en } from './en';

export type Lang = 'es' | 'en';
export type { MessageKey };

const dictionaries: Record<Lang, Record<MessageKey, string>> = { es, en };

/** Normalizes any stored or detected language to a supported one (Spanish by default). */
export function toLang(value: unknown): Lang {
  return value === 'en' ? 'en' : 'es';
}

/** Translates a key, replacing `{name}` placeholders with `vars`. */
export function t(lang: Lang, key: MessageKey, vars: Record<string, string> = {}): string {
  const template = dictionaries[lang][key] ?? es[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}
