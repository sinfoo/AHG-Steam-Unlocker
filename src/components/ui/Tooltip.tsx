import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORS } from '../../constants/colors'

export interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

type Coords = { top: number; left: number }

const arrowSize = 6

export const Tooltip = memo(function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const tooltip = tooltipRef.current.getBoundingClientRect()
    const gap = 8

    const positions: Record<string, Coords> = {
      top: {
        left: trigger.left + trigger.width / 2 - tooltip.width / 2,
        top: trigger.top - tooltip.height - gap,
      },
      bottom: {
        left: trigger.left + trigger.width / 2 - tooltip.width / 2,
        top: trigger.bottom + gap,
      },
      left: {
        left: trigger.left - tooltip.width - gap,
        top: trigger.top + trigger.height / 2 - tooltip.height / 2,
      },
      right: {
        left: trigger.right + gap,
        top: trigger.top + trigger.height / 2 - tooltip.height / 2,
      },
    }

    setCoords(positions[position]!)
  }, [position])

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setVisible(true)
    }, delay)
  }, [delay])

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setVisible(false)
  }, [])

  useEffect(() => {
    if (!visible) return
    updatePosition()
    // rAF-throttled scroll handler — coalesces all scroll events into one per frame
    // avoids forced layout reflow via getBoundingClientRect on every scroll tick
    let rafId: number | null = null
    const onScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          updatePosition()
          rafId = null
        })
      }
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [visible, updatePosition])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div
      ref={triggerRef}
      style={{ display: 'inline-flex', position: 'relative' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              zIndex: 9999,
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              color: COLORS.white,
              background: COLORS.bgDeep,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '0.5rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              lineHeight: 1.4,
            }}
          >
            {content}
            {/* Arrow */}
            <div
              style={{
                position: 'absolute',
                width: 0,
                height: 0,
                borderStyle: 'solid',
                ...arrowPosition(position, arrowSize),
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

function arrowPosition(
  position: NonNullable<TooltipProps['position']>,
  size: number
): Record<string, string | number> {
  switch (position) {
    case 'top':
      return {
        top: '100%',
        left: '50%',
        marginLeft: -size,
        borderWidth: `${size}px ${size}px 0 ${size}px`,
        borderColor: `${COLORS.bgDeep} transparent transparent transparent`,
      }
    case 'bottom':
      return {
        bottom: '100%',
        left: '50%',
        marginLeft: -size,
        borderWidth: `0 ${size}px ${size}px ${size}px`,
        borderColor: `transparent transparent ${COLORS.bgDeep} transparent`,
      }
    case 'left':
      return {
        left: '100%',
        top: '50%',
        marginTop: -size,
        borderWidth: `${size}px 0 ${size}px ${size}px`,
        borderColor: `transparent transparent transparent ${COLORS.bgDeep}`,
      }
    case 'right':
      return {
        right: '100%',
        top: '50%',
        marginTop: -size,
        borderWidth: `${size}px ${size}px ${size}px 0`,
        borderColor: `transparent ${COLORS.bgDeep} transparent transparent`,
      }
  }
}
