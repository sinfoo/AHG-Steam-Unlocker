import { useEffect, useRef } from 'react'

const imageObserver = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const callback = (entry.target as HTMLElement).dataset._lazyCallback
            if (callback) {
              try { (window as any)[callback]?.() } catch {}
            }
            imageObserver!.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '500px 0px', threshold: 0 }
    )
  : null

export function useLazyImage(elRef: React.RefObject<HTMLElement | null>, onVisible: () => void) {
  const callbackRef = useRef(onVisible)
  callbackRef.current = onVisible
  const callbackIdRef = useRef<string | null>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el || !imageObserver) {
      onVisible()
      return
    }
    // Generate unique callback ID
    const id = '_lazy_img_' + Math.random().toString(36).slice(2, 9)
    callbackIdRef.current = id
    ;(window as any)[id] = () => callbackRef.current()
    el.dataset._lazyCallback = id
    imageObserver.observe(el)
    return () => {
      imageObserver.unobserve(el)
      delete (window as any)[id]
      delete el.dataset._lazyCallback
    }
  }, [elRef])
}
