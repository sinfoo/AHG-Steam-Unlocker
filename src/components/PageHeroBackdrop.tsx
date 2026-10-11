import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { loadGameImage } from '../services/imageCache'
import type { Game } from '../types'

/**
 * Content-driven hero backdrop: loads a game's wide hero art and renders it as a slowly
 * zooming, darkened, accent-washed layer behind a page header. Turns the abstract
 * orb/particle heroes on Library / Favourites / Recent into premium, image-led headers
 * (matching the Fixes hero). Renders nothing until art resolves, so it never flashes.
 */
export function PageHeroBackdrop({ game, accent }: { game?: Game | null; accent: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setUrl(null)
    if (!game?.appid) return
    loadGameImage(
      game.appid, game.header_image || undefined, game.name || undefined,
      ['library_hero.jpg', 'hero.jpg', 'library_600x900.jpg', 'header.jpg'],
    ).then(u => { if (mounted) setUrl(u) }).catch(() => {})
    return () => { mounted = false }
  }, [game?.appid])

  if (!url) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <motion.img
        src={url}
        alt=""
        decoding="async"
        fetchPriority="low"
        className="w-full h-full object-cover"
        style={{ objectPosition: 'center 28%' }}
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1.15, opacity: 1 }}
        transition={{ scale: { duration: 26, ease: 'linear' }, opacity: { duration: 1.1, ease: 'easeOut' } }}
      />
      {/* Diagonal darken + accent wash keeps the title crisp over any art */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(118deg, rgba(3,3,8,0.94) 0%, rgba(3,3,8,0.72) 42%, ${accent}26 100%)` }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(3,3,8,0.88) 0%, transparent 58%)' }} />
    </div>
  )
}
