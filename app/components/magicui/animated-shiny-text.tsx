'use client'

import type { CSSProperties, ReactNode } from 'react'

interface AnimatedShinyTextProps {
  children: ReactNode
  shimmerWidth?: number
  style?: CSSProperties
  className?: string
}

export function AnimatedShinyText({
  children,
  shimmerWidth = 160,
  style,
  className,
}: AnimatedShinyTextProps) {
  return (
    <>
      <style>{`
        @keyframes shiny-sweep {
          0%   { background-position: calc(-1 * var(--sw)) center; }
          60%, 100% { background-position: calc(100% + var(--sw)) center; }
        }
        .shiny-text-anim {
          background-image: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.55) 50%,
            transparent 100%
          );
          background-size: var(--sw) 100%;
          background-repeat: no-repeat;
          -webkit-background-clip: text;
          background-clip: text;
          animation: shiny-sweep 3.5s ease infinite;
        }
      `}</style>
      <span
        className={`shiny-text-anim${className ? ` ${className}` : ''}`}
        style={{ '--sw': `${shimmerWidth}px`, ...style } as CSSProperties}
      >
        {children}
      </span>
    </>
  )
}
