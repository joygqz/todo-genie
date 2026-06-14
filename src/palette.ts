import { ThemeColor } from 'vscode'

// Built-in theme colours reused for tag accents so they adapt to light, dark,
// and high-contrast themes without any user colour configuration. A tag is
// assigned a colour by its sorted position among the configured tags, cycling
// when there are more tags than palette entries. Shared by the editor decorator
// and the tree view so a tag looks identical in both places.
const PALETTE = [
  'charts.yellow',
  'charts.red',
  'charts.orange',
  'charts.blue',
  'charts.green',
  'charts.purple',
]

export type TagColors = Map<string, ThemeColor>

const FALLBACK = new ThemeColor(PALETTE[0])

/** Map each configured tag (upper-cased) to its palette colour. */
export function buildTagColors(tags: string[]): TagColors {
  const sorted = [...new Set(tags.map(tag => tag.toUpperCase()))].sort()
  const colors: TagColors = new Map()
  sorted.forEach((tag, index) => {
    colors.set(tag, new ThemeColor(PALETTE[index % PALETTE.length]))
  })
  return colors
}

/** Colour for a tag, falling back to the first palette entry if unknown. */
export function tagColor(colors: TagColors, tag: string): ThemeColor {
  return colors.get(tag.toUpperCase()) ?? FALLBACK
}
