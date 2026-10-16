import { useCallback } from 'react'
import { useUIStore, useUserStore, useSettingsStore } from '../store'
import type { LogEntry } from '../types'

// Monotonic counter for toast ids — guarantees uniqueness even when two toasts
// are created within the same millisecond (Date.now() collisions previously
// produced duplicate React keys and dismissed both toasts at once).
let toastIdCounter = 0

export function useToastNotifications() {
  const setToasts = useUIStore(s => s.setToasts)
  const setLogs = useUserStore(s => s.setLogs)

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'favorites' | 'info' = 'info') => {
    const id = ++toastIdCounter
    if (type === 'error' || useSettingsStore.getState().notifications) setToasts(prev => [...prev, { id, message, type }])
    useUIStore.getState().pushNotif({ id, message, type })
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [setToasts])

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs(prev => [...prev.slice(-499), { time, message, type }])
    if (type === 'error') showToast(message, 'error')
  }, [showToast, setLogs])

  return { showToast, addLog }
}

export default useToastNotifications
