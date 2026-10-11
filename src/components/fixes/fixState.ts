import { create } from 'zustand'

// Session-only record of fixes applied from the Fixes page (feeds the "Applied" stat,
// the card state and the Library "Fixes" column). Downloads run one at a time.
interface FixState {
  applied: Record<string, true>
  applying: string | null
  begin: (appid: string) => void
  finish: (appid: string, ok: boolean) => void
}

export const useFixState = create<FixState>((set) => ({
  applied: {},
  applying: null,
  begin: (appid) => set({ applying: appid }),
  finish: (appid, ok) => set((s) => ({ applying: s.applying === appid ? null : s.applying, applied: ok ? { ...s.applied, [appid]: true } : s.applied })),
}))
