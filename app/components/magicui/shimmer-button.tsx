'use client'

import type { ComponentPropsWithoutRef, CSSProperties } from 'react'

interface ShimmerButtonProps extends ComponentPropsWithoutRef<'button'> {
  shimmerColor?: string
  background?: string
  borderRadius?: string
  shimmerDuration?: string
}

export function ShimmerButton({
  children,
  shimmerColor = 'rgba(255,255,255,0.18)',
  background = 'linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)',
  borderRadius = '14px',
  shimmerDuration = '2.5s',
  style,
  ...props
}: ShimmerButtonProps) {
  return (
    <>
      <style>{`
        @keyframes shimmer-sweep {
          0%   { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(250%)  skewX(-12deg); }
        }
        .shimmer-btn-inner { animation: shimmer-sweep var(--sd, 2.5s) ease infinite; }
      `}</style>
      <button
        style={
          {
            position: 'relative',
            overflow: 'hidden',
            background,
            borderRadius,
            border: 'none',
            cursor: 'pointer',
            '--sd': shimmerDuration,
            ...style,
          } as CSSProperties
        }
        {...props}
      >
        {/* shimmer sweep overlay */}
        <div
          className="shimmer-btn-inner"
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, transparent 0%, ${shimmerColor} 50%, transparent 100%)`,
            width: '40%',
            pointerEvents: 'none',
          }}
        />
        {/* content sits above */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      </button>
    </>
  )
}
