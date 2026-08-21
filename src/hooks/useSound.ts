import { useCallback } from 'react'
import { useSettingsStore } from '../store'

// Single shared AudioContext, created lazily and reused for every sound.
// Previously a new AudioContext was created on every playSound() call; browsers
// cap concurrent contexts (~6 in Chromium), after which construction throws and
// all audio silently dies while the orphaned contexts leak.
let sharedCtx: AudioContext | null = null
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as any).webkitAudioContext
  if (!AC) return null
  if (!sharedCtx) sharedCtx = new AC()
  if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {})
  return sharedCtx
}

export function useSound() {
  const soundEnabled = useSettingsStore(s => s.soundEnabled)

  const playSound = useCallback((type: 'success' | 'error' | 'click' | 'hover' | 'achievement') => {
    if (!soundEnabled) return
    try {
      const ctx = getAudioContext()
      if (!ctx) return
      const now = ctx.currentTime

      // Achievement: play ascending chime C5 → E5 → G5
      if (type === 'achievement') {
        const notes = [523, 659, 784] // C5, E5, G5
        const noteDuration = 0.12
        const spacing = 0.06
        for (let i = 0; i < notes.length; i++) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.type = 'sine'
          osc.frequency.setValueAtTime(notes[i]!, now + i * spacing)
          gain.gain.setValueAtTime(0, now + i * spacing)
          gain.gain.linearRampToValueAtTime(0.04, now + i * spacing + 0.005)
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * spacing + noteDuration)
          osc.start(now + i * spacing)
          osc.stop(now + i * spacing + noteDuration)
        }
        return
      }

      const osc = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)
      const cfg: Record<string, { f: number; f2: number; d: number }> = { success: { f: 220, f2: 330, d: 0.6 }, error: { f: 110, f2: 165, d: 0.4 }, click: { f: 440, f2: 660, d: 0.1 }, hover: { f: 880, f2: 1200, d: 0.08 } }
      const c = cfg[type]!
      osc.frequency.setValueAtTime(c.f, now)
      osc2.frequency.setValueAtTime(c.f2, now)
      osc.type = 'sine'
      osc2.type = 'sine'
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + c.d)
      osc.start(now)
      osc.stop(now + c.d)
    } catch {}
  }, [soundEnabled])

  return { playSound }
}

export default useSound
