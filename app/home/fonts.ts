import { Barlow_Condensed, IBM_Plex_Sans } from 'next/font/google'

// Condensed, high-impact display face for the scoreboard-style numerals and
// headlines on the homepage only — scoped via CSS variable, not applied globally.
export const homeHeadingFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-home-heading',
  display: 'swap',
})

// Body/UI face for labels, table cells, and descriptions.
export const homeBodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-home-body',
  display: 'swap',
})
