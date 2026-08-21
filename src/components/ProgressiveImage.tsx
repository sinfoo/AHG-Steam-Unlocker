import { memo, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

interface ProgressiveImageProps {
  /** High-resolution image URL */
  src: string
  /** Low-quality image placeholder (base64 data URL) */
  lqip?: string
  /** Alt text for the image */
  alt?: string
  /** Additional class names for the image element */
  className?: string
  /** Container style overrides */
  style?: React.CSSProperties
  /** Aspect ratio for layout stability (e.g. "16/9", "3/4") */
  aspectRatio?: string
  /** Callback when high-res image loads successfully */
  onLoad?: () => void
  /** Callback when high-res image fails to load */
  onError?: () => void
}

const SPRING = { duration: 0.08, ease: [0.4, 0, 0.2, 1] as const }

const cssTransition = [
  'filter 80ms cubic-bezier(0.4, 0, 0.2, 1)',
  'transform 80ms cubic-bezier(0.4, 0, 0.2, 1)',
  'opacity 80ms cubic-bezier(0.4, 0, 0.2, 1)',
].join(', ')

/**
 * ProgressiveImage — blur-to-sharp crossfade from LQIP placeholder
 * to full-resolution image. Uses Framer Motion for opacity crossfade
 * and CSS transitions for filter (blur) and transform (scale) to
 * hide compression artifacts during the transition.
 *
 * - LQIP starts with blur(20px) + scale(1.05) to mask low-quality
 * - On high-res load, crossfades to sharp un-blurred image
 * - Maintains aspect ratio via the `aspectRatio` prop
 * - Image load failure keeps LQIP visible at reduced opacity
 */
const ProgressiveImage = memo(function ProgressiveImage({
  src,
  lqip,
  alt = '',
  className = '',
  style,
  aspectRatio,
  onLoad,
  onError,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const loadedRef = useRef(false)

  const handleLoad = useCallback(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    setLoaded(true)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setErrored(true)
    onError?.()
  }, [onError])

  // LQIP is shown when available and no permanent error occurred
  const hasLqip = !!lqip && !errored
  // Full image is hidden behind LQIP while loading, shown after load
  const fullBlurred = hasLqip && !loaded
  // Error degraded: LQIP stays visible but dimmed
  const degraded = errored && !!lqip

  return (
    <div
      className="relative overflow-hidden"
      style={{
        ...(aspectRatio ? { aspectRatio } : {}),
        ...style,
      }}
    >
      {/* ── LQIP placeholder layer ── */}
      {hasLqip && (
        <img
          src={lqip}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          style={{
            objectFit: 'cover',
            filter: loaded ? 'blur(0px)' : 'blur(20px)',
            transform: loaded ? 'scale(1)' : 'scale(1.05)',
            opacity: loaded ? 0 : degraded ? 0.6 : 1,
            transition: cssTransition,
            transformOrigin: 'center center',
          }}
        />
      )}

      {/* ── Full-resolution image layer ── */}
      {!errored && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: hasLqip ? 0 : 1 }}
          animate={{ opacity: loaded || !hasLqip ? 1 : 0 }}
          transition={SPRING}
        >
          <img
            src={src}
            alt={alt}
            className={`w-full h-full ${className}`}
            style={{
              objectFit: 'cover',
              filter: fullBlurred ? 'blur(20px)' : 'blur(0px)',
              transform: fullBlurred ? 'scale(1.05)' : 'scale(1)',
              transition: cssTransition,
              transformOrigin: 'center center',
            }}
            onLoad={handleLoad}
            onError={handleError}
          />
        </motion.div>
      )}

      {/* ── Failed state (no LQIP fallback) ── */}
      {errored && !lqip && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50">
          <span className="text-neutral-500 text-sm select-none">
            Failed to load
          </span>
        </div>
      )}
    </div>
  )
})

export default ProgressiveImage
