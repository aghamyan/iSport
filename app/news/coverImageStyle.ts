import type { CSSProperties } from 'react'

// object-fit:cover handles the base crop via objectPosition; zoom > 1 layers
// a CSS scale on top, centered on that same focal point, so the two values
// saved by the reposition modal compose into one visual result everywhere
// the cover image renders.
export function coverImageStyle(position: string, zoom: number): CSSProperties {
  return {
    objectFit: 'cover',
    objectPosition: position,
    transform: zoom && zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: position,
  }
}
