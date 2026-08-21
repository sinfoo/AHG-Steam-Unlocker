import { memo } from 'react'
import { COLORS } from '../constants/colors'

interface AnimatedBackgroundProps {
  currentPage?: string
}

const AnimatedBackground = memo(function AnimatedBackground(_props: AnimatedBackgroundProps) {
  const colors = { primary: COLORS.violet, secondary: COLORS.blue, tertiary: COLORS.pink }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ background: COLORS.bgDeep }}>
      <style>{`
        @keyframes orb1Anim {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(100px, -50px) scale(1.2); }
        }
        @keyframes orb2Anim {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-80px, 60px) scale(1.3); }
        }
        @keyframes orb3Anim {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(50px, 80px) scale(1.1); }
        }
        @keyframes orb4Anim {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-60px, -40px) scale(1.15); }
        }
        .orb-anim-1 { animation: orb1Anim 20s linear infinite; }
        .orb-anim-2 { animation: orb2Anim 15s linear infinite; }
        .orb-anim-3 { animation: orb3Anim 18s linear infinite; }
        .orb-anim-4 { animation: orb4Anim 22s linear infinite; }
      `}</style>

      {/* Orb 1 — Primary color */}
      <div
        key="orb1-default"
        className="absolute w-[600px] h-[600px] rounded-full orb-anim-1"
        style={{
          background: `radial-gradient(circle, ${colors.primary}45 0%, ${colors.primary}15 40%, transparent 70%)`,
          top: '-10%',
          left: '-10%',
          filter: 'blur(25px)',
          willChange: 'transform, filter',
        }}
      />

      {/* Orb 2 — Secondary color */}
      <div
        key="orb2-default"
        className="absolute w-[500px] h-[500px] rounded-full orb-anim-2"
        style={{
          background: `radial-gradient(circle, ${colors.secondary}35 0%, ${colors.secondary}12 40%, transparent 70%)`,
          top: '20%',
          right: '-5%',
          filter: 'blur(25px)',
          willChange: 'transform, filter',
        }}
      />

      {/* Orb 3 — Tertiary color */}
      <div
        key="orb3-default"
        className="absolute w-[400px] h-[400px] rounded-full orb-anim-3"
        style={{
          background: `radial-gradient(circle, ${colors.tertiary}35 0%, ${colors.tertiary}12 40%, transparent 70%)`,
          bottom: '-5%',
          left: '20%',
          filter: 'blur(25px)',
          willChange: 'transform, filter',
        }}
      />

      {/* Orb 4 — Cyan accent */}
      <div
        className="absolute w-[450px] h-[450px] rounded-full orb-anim-4"
        style={{
          background: `radial-gradient(circle, ${COLORS.cyan}30 0%, ${COLORS.cyan}12 40%, transparent 70%)`,
          bottom: '10%',
          right: '10%',
          filter: 'blur(25px)',
          willChange: 'transform, filter',
        }}
      />

      {/* Grid dot overlay */}
      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(${COLORS.border}15 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        opacity: 0.4,
      }} />
    </div>
  )
})

export { AnimatedBackground }
