import { useEffect } from 'react'
import { bridge } from '../bridge'
import { useDiscordStore, useUIStore, useSettingsStore } from '../store'
import { achievementRefs } from './achievementRefs'

export function useDiscordAuth() {
  useEffect(() => {
    let cancelled = false

    async function checkDiscordAuth() {
      try {
        const auth = await bridge.checkDiscordAuth()
        if (!cancelled && auth && auth.authenticated) {
          useDiscordStore.getState().setDiscordConnected(true)
          achievementRefs.trackDiscordConnected()
          useDiscordStore.getState().setDiscordUser(auth.user)
          const sharing = await bridge.getGameSharing()
          if (!cancelled) {
            useSettingsStore.getState().setGameSharingEnabled(sharing.enabled)
          }
        } else if (!cancelled) {
          try {
            const pref = await bridge.getDiscordStartupPref()
            if (pref.showOnStartup !== false) {
              useUIStore.getState().setStartupDiscordModal(true)
              useDiscordStore.getState().setDiscordModalOpen(true)
            }
          } catch (e) {
            if (import.meta.env.DEV) console.log('Discord startup pref check error:', e)
          }
        }
      } catch (e) {
        if (import.meta.env.DEV) console.log('Discord auth check error:', e)
      }
    }

    checkDiscordAuth()
    return () => { cancelled = true }
  }, [])
}
