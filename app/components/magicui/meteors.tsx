'use client'

import { useEffect, useState } from 'react'

interface MeteorStyle {
  top: string
  left: string
  animationDelay: string
  animationDuration: string
}

export function Meteors({ number = 12 }: { number?: number }) {
  const [styles, setStyles] = useState<MeteorStyle[]>([])

  useEffect(() => {
    setStyles(
      [...new Array(number)].map(() => ({
        top: `${Math.random() * 60}%`,
        left: `${Math.random() * 100}%`,
        animationDelay: `${(Math.random() * 3).toFixed(2)}s`,
        animationDuration: `${(Math.random() * 7 + 3).toFixed(2)}s`,
      })),
    )
  }, [number])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <style>{`
        @keyframes meteor-fall {
          0%   { transform: rotate(215deg) translateX(0);      opacity: 1; }
          70%  {                                                opacity: 1; }
          100% { transform: rotate(215deg) translateX(-600px); opacity: 0; }
        }
      `}</style>
      {styles.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            width: 2,
            height: 2,
            borderRadius: '50%',
            background: '#a1a1aa',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.07)',
            animation: `meteor-fall ${s.animationDuration} linear ${s.animationDelay} infinite`,
            pointerEvents: 'none',
          }}
        >
          {/* tail */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              height: 1,
              width: 60,
              transform: 'translateY(-50%)',
              background: 'linear-gradient(90deg, rgba(161,161,170,0.6), transparent)',
              zIndex: -1,
            }}
          />
        </span>
      ))}
    </div>
  )
}
