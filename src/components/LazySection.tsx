import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * LazySection — renders children only when the section is within `rootMargin` of the viewport.
 * Falls back to a placeholder <div> of matching min-height before triggering.
 * Once triggered, children render permanently (no un-mount on scroll away).
 */
export function LazySection({
  children,
  className = '',
  style,
  rootMargin = '300px 0px',
  placeholder,
  minHeight,
}: {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  rootMargin?: string
  placeholder?: ReactNode
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (visible) return // already triggered

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry!.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin, visible])

  return (
    <div ref={ref} className={className} style={{ minHeight: minHeight ?? 0, ...style }}>
      {visible ? children : (placeholder ?? null)}
    </div>
  )
}
