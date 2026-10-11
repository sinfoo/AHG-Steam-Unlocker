import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { loadGameImage, getLqipData, getCachedImageSync, invalidateCacheKey, IMAGE_TYPES, steamCdnUrl, directCoverTypes, rememberCover } from '../services/imageCache'
import { WebGLRenderer } from '../services/webglRenderer'
import { generatePlaceholderGradient } from '../services/placeholderGenerator'
import { COLORS } from '../constants/colors'

interface GameCoverProps {
  appid: string
  name?: string
  localHeader?: string
  className?: string
  style?: React.CSSProperties
  eager?: boolean
  preferredImageTypes?: readonly string[]
  genreHue?: number
  /** Opt-out of WebGL rendering for this specific cover (e.g. for testing) */
  webglDisabled?: boolean
}

// ── Component ─────────────────────────────────────────────────────────

const GameCover = memo(function GameCover({
  appid,
  name,
  localHeader,
  className,
  style,
  eager,
  preferredImageTypes,
  genreHue,
  webglDisabled,
}: GameCoverProps) {
  const [state, setState] = useState<{ url: string | null; loaded: boolean; error: boolean }>({
    url: null,
    loaded: false,
    error: false,
  })
  const [lqip, setLqip] = useState<string | null>(null)
  const [webglFailed, setWebglFailed] = useState(false)

  // Detect WebGL support once per component instance
  // ponytail: WebGL cover rendering dropped — one GL context per card hit browser limits and its
  // crossfade only delayed paint; the plain <img> path below paints as soon as bytes arrive.
  const [supportsWebgl] = useState(() => false && !webglDisabled && WebGLRenderer.isSupported())

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const animFrameRef = useRef<number>(0)
  const hasLoadedRef = useRef(false)
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Bounded retry: a single transient CDN miss (timeout, queued behind the fetch
  // concurrency cap, brief offline) used to latch the cover to a permanent
  // placeholder because hasLoadedRef stayed true and nothing ever retried.
  const retryRef = useRef(0)
  const loadImageRef = useRef<(() => void) | null>(null)
  const crossfadeActiveRef = useRef(false)
  const contextLostRef = useRef(false)
  const urlRef = useRef<string | null>(null)
  const loadedAppidRef = useRef<string | null>(null)
  // Direct path: <img src=Steam CDN> starts the instant the card mounts (browser HTTP cache + HTTP/2);
  // on 404 it walks the preferred types, then falls back to the full loadGameImage pipeline.
  const directActiveRef = useRef(false)
  const directIdxRef = useRef(0)
  const directTypesRef = useRef<string[]>([])

  // ── LQIP → Full crossfade animation ─────────────────────────────

  const startCrossfade = useCallback(() => {
    const renderer = rendererRef.current
    if (!renderer || crossfadeActiveRef.current) return

    crossfadeActiveRef.current = true
    const startTime = performance.now()

    const tick = (now: number) => {
      if (!rendererRef.current) return
      const elapsed = now - startTime
      const progress = Math.min(elapsed / 350, 1)
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3)
      rendererRef.current.setMix(eased)
      rendererRef.current.render()

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick)
      } else {
        crossfadeActiveRef.current = false
        setState(prev => ({ ...prev, loaded: true }))
      }
    }

    animFrameRef.current = requestAnimationFrame(tick)
  }, [])

  // ── WebGL renderer setup ─────────────────────────────────────────

  useEffect(() => {
    if (!supportsWebgl || !canvasRef.current) return
    const renderer = new WebGLRenderer(canvasRef.current)
    rendererRef.current = renderer

    // Sync initial container size
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        renderer.resize(rect.width, rect.height)
      }
    }

    // ── Context loss / restore handling ──
    const canvas = canvasRef.current
    const handleContextLost = (e: Event): void => {
      e.preventDefault()
      contextLostRef.current = true
      if (rendererRef.current) {
        rendererRef.current.contextLost = true
      }
      setWebglFailed(true)
    }
    const handleContextRestored = async (): Promise<void> => {
      contextLostRef.current = false
      const newRenderer = new WebGLRenderer(canvas)
      rendererRef.current = newRenderer
      setWebglFailed(false)

      // Re-upload current texture if available
      if (urlRef.current) {
        try {
          await newRenderer.loadTexture(urlRef.current)
        } catch {
          // If re-upload fails, fall back to img fallback
          setWebglFailed(true)
        }
      }
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      crossfadeActiveRef.current = false
      cancelAnimationFrame(animFrameRef.current)
      renderer.destroy()
      rendererRef.current = null
    }
  }, [supportsWebgl])

  // ── ResizeObserver for canvas sizing ─────────────────────────────

  useEffect(() => {
    if (!supportsWebgl || !containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0 && !contextLostRef.current) {
          rendererRef.current?.resize(width, height)
        }
      }
    })

    observer.observe(containerRef.current)
    resizeObserverRef.current = observer

    return () => {
      observer.disconnect()
      resizeObserverRef.current = null
    }
  }, [supportsWebgl])

  // ── Image loading ────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)

    // Only reset state when appid actually changes — not on other dep changes
    // (prevents clearing state to null when deps like preferredImageTypes
    //  change reference without appid changing, which caused the black flash)
    if (loadedAppidRef.current !== appid) {
      loadedAppidRef.current = appid
      hasLoadedRef.current = false
      retryRef.current = 0
      setState({ url: null, loaded: false, error: false })
      setLqip(null)
      setWebglFailed(false)
    } else if (hasLoadedRef.current) {
      // Same appid, already loaded — skip to prevent black flash
      return () => { mounted = false }
    }

    // ── Fast path: cover already resident in memory → paint instantly ──
    // Bypasses the IntersectionObserver wait, the load stagger, and the
    // blur-up crossfade. Eliminates the shimmer flash when scrolling back to
    // already-loaded covers or restoring the window from minimize — the user
    // never witnesses a cover "rendering" for anything seen once this session.
    const memUrl = getCachedImageSync(appid, preferredImageTypes)
    if (memUrl) {
      hasLoadedRef.current = true
      urlRef.current = memUrl
      setState({ url: memUrl, loaded: true, error: false })
      const renderer = rendererRef.current
      if (renderer && !contextLostRef.current) {
        renderer.loadTexture(memUrl)
          .then(() => { if (mounted) { renderer.setMix(1); renderer.render() } })
          .catch(() => { if (mounted) setWebglFailed(true) })
      }
      return () => { mounted = false }
    }

    const MAX_IMG_RETRIES = 3
    // Re-attempt a failed load with backoff instead of latching the placeholder.
    // Returns true if a retry was scheduled, false if the cap is reached.
    const scheduleRetry = (): boolean => {
      if (retryRef.current >= MAX_IMG_RETRIES) return false
      retryRef.current++
      hasLoadedRef.current = false
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = setTimeout(() => { if (mounted) loadImage() }, 600 * retryRef.current)
      return true
    }

    const loadImage = () => {
      if (hasLoadedRef.current) return
      hasLoadedRef.current = true

      // Soft timeout: only flips to the placeholder if nothing has painted yet.
      // A late success still recovers (the promise below sets the url).
      loadTimeoutRef.current = setTimeout(() => {
        if (mounted) setState(s => s.url ? s : { url: null, loaded: false, error: true })
      }, 3000)

      loadGameImage(appid, localHeader || undefined, name || undefined, preferredImageTypes)
        .then(url => {
          if (!mounted) return
          if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)

          if (!url) {
            // Miss — retry with backoff; only show the placeholder once retries run out.
            if (!scheduleRetry()) setState({ url: null, loaded: false, error: true })
            return
          }
          retryRef.current = 0

          // A local disk-cache hit (image-cache://) is already on the machine —
          // it decodes instantly, so skip the blur-up + crossfade entirely and
          // paint it sharp at once. This is the path a recipient hits when the
          // zipped win-unpacked folder ships a warmed cache: covers appear with
          // no rendering delay. Network results (blob:) keep the nice blur-up.
          const instant = url.startsWith('image-cache://')

          // Grab LQIP data if available (only needed for the blur-up path)
          const lqipUrl = getLqipData(appid, preferredImageTypes)
          if (lqipUrl && !instant) setLqip(lqipUrl)

          setState({ url, loaded: instant, error: false })
          urlRef.current = url

          // Attempt to load into WebGL renderer
          const renderer = rendererRef.current
          if (renderer && !contextLostRef.current) {
            if (instant) {
              // No crossfade: upload texture and show at full mix immediately.
              renderer.loadTexture(url).then(() => {
                if (!mounted) return
                renderer.setMix(1)
                renderer.render()
              }).catch(() => {
                if (mounted) setWebglFailed(true)
              })
              return
            }

            // Load textures in parallel
            const loadPromises: Promise<void>[] = [renderer.loadTexture(url)]

            if (lqipUrl) {
              loadPromises.push(
                renderer.loadLqipTexture(lqipUrl).then(() => {
                  renderer.setMix(0) // Start at LQIP only
                })
              )
            }

            Promise.all(loadPromises).then(() => {
              if (!mounted) return
              // LQIP is shown immediately (mix=0), start crossfade to full
              startCrossfade()
            }).catch(() => {
              // WebGL texture load failed — switch to img fallback
              // Flag webglFailed so useWebgl becomes false and the <img> path renders
              // state.url is already set, so img fallback will show immediately
              if (mounted) {
                setWebglFailed(true)
                setState(prev => ({ ...prev, loaded: true }))
              }
            })
          }
        })
        .catch(() => {
          if (mounted) {
            if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
            if (!scheduleRetry()) setState(prev => ({ ...prev, url: null, error: true }))
          }
        })
    }
    // Expose to handleImgError so a failed <img> decode can re-attempt too.
    loadImageRef.current = loadImage

    // ── Direct CDN path: no observer, no stagger, no IPC — the browser schedules + caches ──
    const types = directCoverTypes(preferredImageTypes)
    directTypesRef.current = types
    directIdxRef.current = 0
    directActiveRef.current = true
    hasLoadedRef.current = true
    setState({ url: steamCdnUrl(appid, types[0]!), loaded: false, error: false })
    return () => { mounted = false; if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current) }
  }, [appid, localHeader, name, eager, preferredImageTypes, supportsWebgl, startCrossfade])

  // ── Fallback img: handle load/error events ───────────────────────

  const handleImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setState(prev => ({ ...prev, loaded: true }))
      if (directActiveRef.current) { rememberCover(appid, preferredImageTypes, e.currentTarget.currentSrc || e.currentTarget.src); return }

      // Orientation validation: if portrait expected but got landscape, retry with header
      if (
        !supportsWebgl &&
        (preferredImageTypes?.some(t => t.includes('portrait') || t.includes('600x900')))
      ) {
        const img = e.currentTarget
        if (img.naturalWidth > img.naturalHeight && img.naturalWidth > 100) {
          const key = `${appid}:${preferredImageTypes!.join(',')}`
          invalidateCacheKey(key)
          setLqip(null)
          loadGameImage(appid, localHeader || undefined, name || undefined, IMAGE_TYPES.HEADER).then(url => {
            if (url) {
              setState({ url, loaded: true, error: false })
              const lqipUrl = getLqipData(appid, IMAGE_TYPES.HEADER)
              if (lqipUrl) setLqip(lqipUrl)
            }
          })
        }
      }
    },
    [appid, localHeader, name, preferredImageTypes, supportsWebgl],
  )

  const handleImgError = useCallback(() => {
    if (directActiveRef.current) {
      const next = ++directIdxRef.current
      const types = directTypesRef.current
      if (next < types.length) { setState({ url: steamCdnUrl(appid, types[next]!), loaded: false, error: false }); return }
      // CDN has none of the types → hand over to the full pipeline (mirrors, SteamGridDB, local header)
      directActiveRef.current = false
      hasLoadedRef.current = false
      setState({ url: null, loaded: false, error: false })
      loadImageRef.current?.()
      return
    }
    // The resolved URL failed to decode (revoked blob, corrupt/half-written disk
    // cache entry, 404). Invalidate the cached entry and re-run the loader so it
    // refetches from the network instead of stranding a broken cover.
    if (retryRef.current < 3 && loadImageRef.current) {
      retryRef.current++
      const key = preferredImageTypes?.length ? `${appid}:${[...preferredImageTypes].join(',')}` : appid
      invalidateCacheKey(key)
      hasLoadedRef.current = false
      setLqip(null)
      setState({ url: null, loaded: false, error: false })
      loadImageRef.current()
      return
    }
    setState(prev => ({ ...prev, url: null, error: true }))
  }, [appid, preferredImageTypes])

  // ── Derived values ───────────────────────────────────────────────

  const initial = name ? name[0]!.toUpperCase() : '?'
  const appidStr = String(appid)
  const gradientSeed = appidStr.charCodeAt(0) + appidStr.charCodeAt(appidStr.length - 1)
  const hue1 = (gradientSeed * 37) % 360
  const activeHue = genreHue ?? hue1
  const gradient = generatePlaceholderGradient(activeHue, 'card')
  const iconGradient = generatePlaceholderGradient(activeHue, 'icon')

  const useWebgl = supportsWebgl && !webglDisabled && !webglFailed

  // ── Main render — uses ternary pattern (proven in backup 2026-06-18) ──
  //
  // KEY DESIGN: This is a single ternary, NOT two separate conditionals.
  // The two-conditional approach (state.url && <img> + showLoadingState && <shimmer>)
  // creates a gap where NEITHER is rendered (url exists but loaded=false + no lqip).
  // The ternary guarantees something always renders: either the image path or the
  // fallback shimmer — never a blank/black container.

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className || ''}`}
      style={{ ...style, background: gradient, transform: 'translateZ(0)' }}
    >
      {state.url ? (
        <>
          {/* ── Image path: image is always in DOM once URL is known ── */}
          {lqip && (
            <img
              src={lqip}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full pointer-events-none select-none"
              decoding="async"
              fetchPriority="low"
              style={{
                objectFit: 'cover',
                filter: 'blur(20px) scale(1.1)',
                opacity: state.loaded ? 0 : 1,
                transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                transformOrigin: 'center center',
              }}
            />
          )}
          <img
            src={state.url}
            alt={name}
            className="w-full h-full object-cover"
            decoding="async"
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'auto'}
            style={{
              opacity: state.loaded ? 1 : lqip ? 0 : 0,
              transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              imageRendering: 'auto',
            }}
            onLoad={handleImgLoad}
            onError={handleImgError}
          />
        </>
      ) : (
        /* ── Fallback path: shimmer + initial letter ── */
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {!state.error && (
            <div className="absolute inset-0 pointer-events-none shimmer-overlay" aria-hidden="true" />
          )}
          <span
            style={{
              color: `hsl(${activeHue}, 45%, 78%)`,
              fontSize: className?.includes('h-36') ? 36 : 22,
              fontWeight: 600,
              letterSpacing: '-.02em',
              opacity: 0.8,
            }}
          >
            {initial}
          </span>
          {state.error && name && className?.includes('h-36') && (
            <span
              className="text-xs"
              style={{
                color: COLORS.textMuted,
                marginTop: 4,
                textAlign: 'center',
                padding: '0 8px',
              }}
            >
              {name.length > 30 ? name.slice(0, 30) + '...' : name}
            </span>
          )}
        </div>
      )}

      {/* ── WebGL canvas enhancement - always on top if active ── */}
      {useWebgl && state.url && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          aria-hidden="true"
          style={{ transform: 'translateZ(0)' }}
        />
      )}
    </div>
  )
})

export default GameCover
