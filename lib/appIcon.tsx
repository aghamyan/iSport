import { ImageResponse } from 'next/og'

export function createAppIconResponse() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 36,
          background: 'linear-gradient(145deg, #111827 0%, #030712 100%)',
          color: '#ffffff',
          fontSize: 56,
          fontWeight: 900,
          letterSpacing: '-0.04em',
        }}
      >
        FC<span style={{ color: '#ef4444' }}>26</span>
      </div>
    ),
    {
      width: 180,
      height: 180,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  )
}
