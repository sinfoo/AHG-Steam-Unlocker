import { create } from 'zustand'

type SetStateAction<T> = T | ((prev: T) => T)

export interface DiscordState {
  discordModalOpen: boolean
  discordConnected: boolean
  discordUser: any
  
  setDiscordModalOpen: (value: SetStateAction<boolean>) => void
  setDiscordConnected: (value: SetStateAction<boolean>) => void
  setDiscordUser: (value: SetStateAction<any>) => void
}

export const useDiscordStore = create<DiscordState>((set) => ({
  discordModalOpen: false,
  discordConnected: false,
  discordUser: null,
  
  setDiscordModalOpen: (v) => set((s) => ({ discordModalOpen: typeof v === 'function' ? v(s.discordModalOpen) : v })),
  setDiscordConnected: (v) => set((s) => ({ discordConnected: typeof v === 'function' ? v(s.discordConnected) : v })),
  setDiscordUser: (v) => set((s) => ({ discordUser: typeof v === 'function' ? v(s.discordUser) : v })),
}))

// Selector hooks
export const useDiscordModalOpen = () => useDiscordStore((s) => s.discordModalOpen)
export const useDiscordConnected = () => useDiscordStore((s) => s.discordConnected)
export const useDiscordUser = () => useDiscordStore((s) => s.discordUser)
