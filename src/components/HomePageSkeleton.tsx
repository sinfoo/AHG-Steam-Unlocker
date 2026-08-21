import { motion } from 'framer-motion'

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
}

const fadeSlideUp = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as const },
  },
}

export default function HomePageSkeleton() {
  return (
    <motion.div
      className="page-enter"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Hero skeleton */}
      <motion.div
        variants={fadeSlideUp}
        className="relative w-full h-[70vh] min-h-[500px] rounded-2xl overflow-hidden bg-mid animate-pulse mb-8"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent" />
        <div className="absolute bottom-0 left-0 p-8 lg:p-12 space-y-4 w-full">
          <div className="h-8 w-24 rounded-full bg-card" />
          <div className="h-12 w-3/4 rounded-lg bg-card" />
          <div className="h-6 w-1/2 rounded-lg bg-card" />
          <div className="flex gap-4">
            <div className="h-14 w-36 rounded-2xl bg-card" />
            <div className="h-14 w-36 rounded-2xl bg-card" />
          </div>
        </div>
      </motion.div>

      {/* Section skeleton (x3) */}
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          variants={fadeSlideUp}
          className="bg-mid/80 rounded-2xl p-4 mb-6 animate-pulse"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 w-36 rounded bg-card" />
            <div className="h-4 w-16 rounded bg-card" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="aspect-[3/4] rounded-xl bg-card" />
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
