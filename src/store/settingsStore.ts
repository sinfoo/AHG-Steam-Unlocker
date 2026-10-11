import { create } from 'zustand'

type SetStateAction<T> = T | ((prev: T) => T)

// Notifications + auto-update are the only prefs persisted here (others live in-session).
const PREF_KEY = 'ahg.prefs'
const loadPrefs = (): { notifications: boolean; autoUpdates: boolean } => {
  try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); return { notifications: p.notifications !== false, autoUpdates: p.autoUpdates !== false } } catch { return { notifications: true, autoUpdates: true } }
}
const savePrefs = (p: { notifications: boolean; autoUpdates: boolean }) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)) } catch { /* storage unavailable */ } }

export interface SettingsState {
  notifications: boolean
  autoUpdates: boolean
  setNotifications: (v: boolean) => void
  setAutoUpdates: (v: boolean) => void
  // Appearance
  accentColor: 'violet' | 'blue' | 'green' | 'amber' | 'pink'
  pureBlack: boolean
  reducedMotion: boolean
  compactMode: boolean
  
  // Sound
  soundEnabled: boolean
  
  // Game config
  includeDLC: boolean
  quickInstall: boolean
  batchMode: boolean
  
  // Quick tools
  quickToolsOpen: boolean
  
  // Display filters
  hideSearchBars: boolean
  showOnlyOwned: boolean
  
  // Computed
  setAccentColor: (value: SetStateAction<'violet' | 'blue' | 'green' | 'amber' | 'pink'>) => void
  setPureBlack: (value: SetStateAction<boolean>) => void
  setReducedMotion: (value: SetStateAction<boolean>) => void
  setCompactMode: (value: SetStateAction<boolean>) => void
  setSoundEnabled: (value: SetStateAction<boolean>) => void
  setIncludeDLC: (value: SetStateAction<boolean>) => void
  setQuickInstall: (value: SetStateAction<boolean>) => void
  setBatchMode: (value: SetStateAction<boolean>) => void
  setQuickToolsOpen: (value: SetStateAction<boolean>) => void
  setHideSearchBars: (value: SetStateAction<boolean>) => void
  setShowOnlyOwned: (value: SetStateAction<boolean>) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadPrefs(),
  setNotifications: (notifications) => { set({ notifications }); savePrefs({ notifications, autoUpdates: get().autoUpdates }) },
  setAutoUpdates: (autoUpdates) => { set({ autoUpdates }); savePrefs({ notifications: get().notifications, autoUpdates }) },
  // Appearance
  accentColor: 'violet',
  pureBlack: false,
  reducedMotion: false,
  compactMode: false,
  
  // Sound
  soundEnabled: true,
  
  // Game config
  includeDLC: true,
  quickInstall: false,
  batchMode: false,
  
  // Quick tools
  quickToolsOpen: false,
  
  // Display filters
  hideSearchBars: false,
  showOnlyOwned: false,
  
  // Setters (handle both direct values and functional updates)
  setAccentColor: (accentColor) => set((state) => ({
    accentColor: typeof accentColor === 'function' ? accentColor(state.accentColor) : accentColor
  })),
  setPureBlack: (pureBlack) => set((state) => ({
    pureBlack: typeof pureBlack === 'function' ? pureBlack(state.pureBlack) : pureBlack
  })),
  setReducedMotion: (reducedMotion) => set((state) => ({
    reducedMotion: typeof reducedMotion === 'function' ? reducedMotion(state.reducedMotion) : reducedMotion
  })),
  setCompactMode: (compactMode) => set((state) => ({
    compactMode: typeof compactMode === 'function' ? compactMode(state.compactMode) : compactMode
  })),
  setSoundEnabled: (soundEnabled) => set((state) => ({
    soundEnabled: typeof soundEnabled === 'function' ? soundEnabled(state.soundEnabled) : soundEnabled
  })),
  setIncludeDLC: (includeDLC) => set((state) => ({
    includeDLC: typeof includeDLC === 'function' ? includeDLC(state.includeDLC) : includeDLC
  })),
  setQuickInstall: (quickInstall) => set((state) => ({
    quickInstall: typeof quickInstall === 'function' ? quickInstall(state.quickInstall) : quickInstall
  })),
  setBatchMode: (batchMode) => set((state) => ({
    batchMode: typeof batchMode === 'function' ? batchMode(state.batchMode) : batchMode
  })),
  setQuickToolsOpen: (quickToolsOpen) => set((state) => ({
    quickToolsOpen: typeof quickToolsOpen === 'function' ? quickToolsOpen(state.quickToolsOpen) : quickToolsOpen
  })),
  setHideSearchBars: (hideSearchBars) => set((state) => ({
    hideSearchBars: typeof hideSearchBars === 'function' ? hideSearchBars(state.hideSearchBars) : hideSearchBars
  })),
  setShowOnlyOwned: (showOnlyOwned) => set((state) => ({
    showOnlyOwned: typeof showOnlyOwned === 'function' ? showOnlyOwned(state.showOnlyOwned) : showOnlyOwned
  })),
}))

// Selector hooks for performance
export const useAccentColor = () => useSettingsStore((s) => s.accentColor)
export const useSetAccentColor = () => useSettingsStore((s) => s.setAccentColor)
export const usePureBlack = () => useSettingsStore((s) => s.pureBlack)
export const useSetPureBlack = () => useSettingsStore((s) => s.setPureBlack)
export const useReducedMotion = () => useSettingsStore((s) => s.reducedMotion)
export const useCompactMode = () => useSettingsStore((s) => s.compactMode)
export const useSoundEnabled = () => useSettingsStore((s) => s.soundEnabled)
export const useIncludeDLC = () => useSettingsStore((s) => s.includeDLC)
export const useQuickInstall = () => useSettingsStore((s) => s.quickInstall)
export const useBatchMode = () => useSettingsStore((s) => s.batchMode)
export const useQuickToolsOpen = () => useSettingsStore((s) => s.quickToolsOpen)
