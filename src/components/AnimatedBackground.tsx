import { memo } from 'react'

interface AnimatedBackgroundProps {
  currentPage?: string
}

// Flat backdrop — no glows/vignette (animated orbs caused lag; the user asked for no vignette).
const AnimatedBackground = memo(function AnimatedBackground(_props: AnimatedBackgroundProps) {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        background: 'var(--bg,#0a0a14)',
      }}
    />
  )
})

export { AnimatedBackground }
