import { memo } from 'react'
import { motion } from 'framer-motion'
import { DARK_COLORS } from '../constants/colors'

interface SkeletonCardProps {
  colors: typeof DARK_COLORS
}

const SkeletonCard = memo(function SkeletonCard({ colors }: SkeletonCardProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
    >
      <div className="h-[150px] relative overflow-hidden" style={{ background: colors.bgHover }}>
        <div className="animate-shimmer absolute inset-0" />
      </div>
      <div className="p-4 space-y-3">
        <div className="h-4 rounded-lg" style={{ background: colors.bgHover, width: '80%' }} />
        <div className="h-3 rounded-lg" style={{ background: colors.bgHover, width: '40%' }} />
      </div>
    </div>
  )
})

interface SkeletonLoaderProps {
  colors: typeof DARK_COLORS
  count?: number
  columns?: number
}

const SkeletonLoader = memo(function SkeletonLoader({ colors, count = 6, columns }: SkeletonLoaderProps) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: columns
          ? `repeat(${columns}, 1fr)`
          : 'repeat(auto-fill, minmax(240px, 1fr))',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
        >
          <SkeletonCard colors={colors} />
        </motion.div>
      ))}
    </div>
  )
})

interface SkeletonBentoGridProps {
  colors: typeof DARK_COLORS
}

const SkeletonBentoGrid = memo(function SkeletonBentoGrid({ colors }: SkeletonBentoGridProps) {
  const blocks = [
    { span: 'col-span-12', height: 'h-20' },
    { span: 'col-span-12 lg:col-span-8', height: 'h-[320px]' },
    { span: 'col-span-12 lg:col-span-4', height: 'h-[150px]' },
    { span: 'col-span-12 lg:col-span-4', height: 'h-[150px]' },
    { span: 'col-span-12', height: 'h-[200px]' },
    { span: 'col-span-12 lg:col-span-6', height: 'h-[200px]' },
    { span: 'col-span-12 lg:col-span-6', height: 'h-[200px]' },
    { span: 'col-span-12', height: 'h-[180px]' },
  ]

  return (
    <div className="grid grid-cols-12 gap-4">
      {blocks.map((block, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className={`${block.span} ${block.height} rounded-3xl overflow-hidden relative`}
          style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
        >
          <div className="animate-shimmer absolute inset-0" style={{ animationDelay: `${i * 0.1}s` }} />
        </motion.div>
      ))}
    </div>
  )
})

// ── Per-page skeleton layouts ──

/** Browse page: game grid skeleton matching the 4–5 column masonry layout */
export const BrowseSkeleton = memo(function BrowseSkeleton({ colors }: { colors: typeof DARK_COLORS }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))' }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden rounded-2xl"
          style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
        >
          <div className="aspect-[4/5] relative overflow-hidden" style={{ background: colors.bgHover }}>
            <div className="animate-shimmer absolute inset-0" style={{ animationDelay: `${(i % 6) * 0.08}s` }} />
          </div>
          <div className="p-3 space-y-2">
            <div className="h-3 rounded-lg" style={{ background: colors.bgHover, width: '75%' }} />
            <div className="h-2.5 rounded-lg" style={{ background: colors.bgHover, width: '40%' }} />
          </div>
        </motion.div>
      ))}
    </div>
  )
})

/** Library page: list/grid skeleton matching the library's effective columns */
export const LibrarySkeleton = memo(function LibrarySkeleton({ colors, columns }: { colors: typeof DARK_COLORS; columns: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns * 3 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden rounded-2xl"
          style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
        >
          <div className="aspect-[4/5] relative overflow-hidden" style={{ background: colors.bgHover }}>
            <div className="animate-shimmer absolute inset-0" style={{ animationDelay: `${(i % columns) * 0.08}s` }} />
          </div>
          <div className="p-3 space-y-2">
            <div className="h-3 rounded-lg" style={{ background: colors.bgHover, width: '70%' }} />
            <div className="h-2.5 rounded-lg" style={{ background: colors.bgHover, width: '50%' }} />
          </div>
        </motion.div>
      ))}
    </div>
  )
})

/** Fixes page: grid skeleton matching FixGridCard's 16/9 aspect ratio */
export const FixesSkeleton = memo(function FixesSkeleton({ colors }: { colors: typeof DARK_COLORS }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden rounded-xl"
          style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
        >
          <div className="aspect-[16/9] relative overflow-hidden" style={{ background: colors.bgHover }}>
            <div className="animate-shimmer absolute inset-0" style={{ animationDelay: `${(i % 4) * 0.08}s` }} />
          </div>
          <div className="p-3.5 space-y-2.5">
            <div className="h-4 rounded-lg" style={{ background: colors.bgHover, width: '60%' }} />
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded" style={{ background: colors.bgHover }} />
              <div className="h-5 w-20 rounded" style={{ background: colors.bgHover }} />
            </div>
            <div className="h-9 rounded-xl" style={{ background: colors.bgHover }} />
          </div>
        </motion.div>
      ))}
    </div>
  )
})

export { SkeletonCard, SkeletonLoader, SkeletonBentoGrid }
