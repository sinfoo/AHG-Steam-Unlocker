import { create } from 'zustand'
import { useCallback } from 'react'
import en from './locales/en'
import es from './locales/es'
import fr from './locales/fr'
import de from './locales/de'
import pt from './locales/pt'
import tr from './locales/tr'
import zh from './locales/zh'
import ar from './locales/ar'

export type Dict = typeof en
export type TKey = keyof Dict
export type LangCode = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'tr' | 'zh' | 'ar'

export const LANGUAGES: ReadonlyArray<{ code: LangCode; label: string; english: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'en', label: 'English', english: 'English', dir: 'ltr' },
  { code: 'es', label: 'Español', english: 'Spanish', dir: 'ltr' },
  { code: 'fr', label: 'Français', english: 'French', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', english: 'German', dir: 'ltr' },
  { code: 'pt', label: 'Português', english: 'Portuguese', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe', english: 'Turkish', dir: 'ltr' },
  { code: 'zh', label: '简体中文', english: 'Chinese', dir: 'ltr' },
  { code: 'ar', label: 'العربية', english: 'Arabic', dir: 'rtl' },
]

const DICTS: Record<LangCode, Partial<Dict>> = { en, es, fr, de, pt, tr, zh, ar }
const STORAGE_KEY = 'ahg.lang'

function detect(): LangCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as LangCode | null
    if (saved && saved in DICTS) return saved
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase() as LangCode
    if (nav in DICTS) return nav
  } catch { /* ignore */ }
  return 'en'
}

/** Sets <html lang/dir>; the font stack switches via `html[lang=ar]` in index.css. */
function apply(code: LangCode) {
  const el = document.documentElement
  el.lang = code
  el.dir = LANGUAGES.find(l => l.code === code)?.dir ?? 'ltr'
}

export const useLangStore = create<{ lang: LangCode; setLang: (c: LangCode) => void }>(set => ({
  lang: detect(),
  setLang: (code) => {
    try { localStorage.setItem(STORAGE_KEY, code) } catch { /* ignore */ }
    apply(code)
    set({ lang: code })
  },
}))

apply(useLangStore.getState().lang)

function format(str: string, vars?: Record<string, string | number>) {
  return vars ? str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : str
}

/** Non-reactive lookup (event handlers, toasts). Falls back to English, then the key. */
export function t(key: TKey, vars?: Record<string, string | number>): string {
  const lang = useLangStore.getState().lang
  return format(DICTS[lang][key] ?? en[key] ?? String(key), vars)
}

/** Reactive hook: components re-render when the language changes. */
export function useT() {
  const lang = useLangStore(s => s.lang)
  return useCallback(
    (key: TKey, vars?: Record<string, string | number>) => format(DICTS[lang][key] ?? en[key] ?? String(key), vars),
    [lang],
  )
}
