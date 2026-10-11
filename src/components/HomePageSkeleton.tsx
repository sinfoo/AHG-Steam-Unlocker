/** v2 home skeleton — hero + side column + two rails, with a sweeping shimmer. */
const Block = ({ className = '', style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`relative overflow-hidden ${className}`} style={{ background: '#10101c', border: '1px solid rgba(255,255,255,.06)', ...style }}>
    <div className="absolute inset-y-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.05), transparent)', animation: 'v2-hshimmer 1.6s ease-in-out infinite' }} />
  </div>
)

export default function HomePageSkeleton() {
  return (
    <div className="flex flex-col gap-[34px] v2-rise" style={{ padding: '24px 24px 56px', width: '100%', maxWidth: 1680, margin: '0 auto' }}>
      <div className="flex flex-wrap gap-4">
        <Block style={{ flex: '3 1 560px', height: 'clamp(400px,56vh,560px)', borderRadius: 26 }} />
        <div className="flex flex-col gap-4" style={{ flex: '1 1 260px' }}>
          <Block className="flex-1" style={{ minHeight: 200, borderRadius: 22 }} />
          <Block style={{ height: 150, borderRadius: 22 }} />
        </div>
      </div>
      {[0, 1].map(r => (
        <div key={r} className="flex flex-col gap-3.5">
          <Block style={{ width: 220, height: 28, borderRadius: 10 }} />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 8 }).map((_, j) => (
              <Block key={j} className="flex-none" style={{ width: 172, aspectRatio: '2/3', borderRadius: 14 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
