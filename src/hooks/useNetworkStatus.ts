import { useState, useEffect, useCallback } from 'react'

/**
 * Tracks navigator.onLine state via online/offline events.
 *
 * Returns `isOnline` boolean + `wasOffline` (set true if user was offline
 * since mount, cleared on explicit acknowledgement or after 10s online).
 *
 * Re-checks on visibilitychange in case the state was stale during sleep/resume.
 */
export function useNetworkStatus(): { isOnline: boolean; wasOffline: boolean; acknowledge: () => void } {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  const handleOnline = useCallback(() => {
    setIsOnline(true)
    // Clear `wasOffline` after 10s of being back online
    setTimeout(() => setWasOffline(false), 10_000)
  }, [])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
    setWasOffline(true)
  }, [])

  const acknowledge = useCallback(() => setWasOffline(false), [])

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Re-check on visibility change (covers sleep/resume edge case)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setIsOnline(navigator.onLine)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [handleOnline, handleOffline])

  return { isOnline, wasOffline, acknowledge }
}
