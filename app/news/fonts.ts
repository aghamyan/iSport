import { Barlow_Condensed, Barlow } from 'next/font/google'

// Condensed display face for headlines, category labels, and other bold
// uppercase treatments in the news module.
export const newsHeadingFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-news-heading',
  display: 'swap',
})

// Humanist body face for article copy, excerpts, and comments — replaces
// the default system font for long-form reading.
export const newsBodyFont = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-news-body',
  display: 'swap',
})
