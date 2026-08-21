import React, { memo, useEffect, useRef, useState, ReactNode } from 'react';

export interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange';
  genreHue?: number;
  size?: 'sm' | 'md' | 'lg';
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
  style?: React.CSSProperties;
}

const glowColorMap = {
  blue: { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green: { base: 120, spread: 200 },
  red: { base: 0, spread: 200 },
  orange: { base: 30, spread: 200 }
};

const sizeMap = {
  sm: 'w-48 h-64',
  md: 'w-64 h-80',
  lg: 'w-80 h-96'
};

// ── Shared pointer tracking (rAF-throttled) ──
const activeCards = new Set<HTMLDivElement>();
let rafId: number | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener('pointermove', (e: PointerEvent) => {
    if (activeCards.size === 0) return; // skip rAF entirely when no cards mounted/visible
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const xStr = e.clientX.toFixed(2);
      const yStr = e.clientY.toFixed(2);
      const xpStr = (e.clientX / w).toFixed(2);
      const ypStr = (e.clientY / h).toFixed(2);
      for (const el of activeCards) {
        el.style.setProperty('--x', xStr);
        el.style.setProperty('--xp', xpStr);
        el.style.setProperty('--y', yStr);
        el.style.setProperty('--yp', ypStr);
      }
    });
  }, { passive: true });
}

const GlowCard: React.FC<GlowCardProps> = memo(({
  children,
  className = '',
  glowColor = 'blue',
  genreHue,
  size = 'md',
  width,
  height,
  customSize = false,
  style: externalStyle
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(true);

  // Track card visibility — pause rAF loop when card is offscreen (saves GPU during scroll)
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsCardVisible(entry!.isIntersecting),
      { rootMargin: '300px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (!isCardVisible) return;
    activeCards.add(el);
    return () => {
      activeCards.delete(el);
    };
  }, [isCardVisible]);

  const { base, spread } = glowColorMap[glowColor];

  const getSizeClasses = () => {
    if (customSize) return '';
    return sizeMap[size];
  };

  const getInlineStyles = () => {
    const hueBase = genreHue !== undefined ? genreHue : base;
    return {
      '--radius': '14',
      '--border': '2',
      '--backdrop': 'hsl(0 0% 60% / 0.12)',
      '--backup-border': 'var(--backdrop)',
      '--size': '200',
      '--outer': '1',
      '--border-size': 'calc(var(--border, 2) * 1px)',
      '--spotlight-size': 'calc(var(--size, 150) * 1px)',
      ...(genreHue !== undefined
        ? { '--base': genreHue, '--spread': '120' }
        : { '--base': base, '--spread': String(spread) }
      ),
      '--hue': 'calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))',
      '--bg-spot-opacity': isHovered ? '0.3' : '0.1',
      backgroundImage: `radial-gradient(
        var(--spotlight-size) var(--spotlight-size) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 70) * 1%) / var(--bg-spot-opacity, 0.1)), transparent
      )`,
      backgroundColor: 'var(--backdrop, transparent)',
      backgroundSize: 'calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))',
      backgroundPosition: '50% 50%',
      border: isHovered
        ? '1.5px solid hsla(var(--hue, 220), 50%, 55%, 0.25)'
        : 'var(--border-size) solid var(--backup-border)',
      position: 'relative' as const,
      touchAction: 'none' as const,
      ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
      ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
      boxShadow: isHovered
        ? `0 8px 40px hsla(${hueBase}, 50%, 20%, 0.3), 0 0 80px hsla(${hueBase}, 60%, 40%, 0.08), inset 0 0 0 1px hsla(${hueBase}, 60%, 50%, 0.08)`
        : '0 1rem 2rem -1rem rgba(0,0,0,0.5)',
      transition: '--x 0.08s linear, --y 0.08s linear, box-shadow 0.08s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.08s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  };

  return (
    <div
      ref={cardRef}
      style={{ ...getInlineStyles(), ...externalStyle }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        ${getSizeClasses()}
        ${!customSize ? 'aspect-[3/4]' : ''}
        rounded-2xl relative
        grid grid-rows-[1fr_auto]
        shadow-[0_1rem_2rem_-1rem_black]
        p-4 gap-4
        backdrop-blur-[5px]
        transition-all duration-80 ease-[cubic-bezier(0.4,0,0.2,1)]
        active:scale-[0.98]
        select-none
        ${className}
      `}
    >
      {children}
      {/* Premium inner glow ring on hover */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-80 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          opacity: isHovered ? 1 : 0,
          boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.12), inset 0 0 40px rgba(139,92,246,0.03)',
        }}
      />
    </div>
  );
  });

export { GlowCard };
