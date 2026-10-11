import { useT, type TKey } from '../i18n'

const labeller = (prefix: string) => () => {
  const t = useT()
  return (name: string) => {
    const k = (prefix + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) as TKey
    const v = t(k)
    return v === k ? name : v
  }
}

/** Display-only genre/tag translation; unknown names pass through unchanged (filter values stay English). */
export const useGenreLabel = labeller('app.genre.')
/** Display-only fix badge translation (ids used for filtering stay English). */
export const useFixTagLabel = labeller('app.fixtag.')
