import type { TextEditor, TextEditorDecorationType } from 'vscode'
import type { Config } from './config'
import { DecorationRangeBehavior, OverviewRulerLane, Range, ThemeColor, window } from 'vscode'
import { scanDocument } from './scanner'

// Built-in theme colours reused for tag highlights so they adapt to light,
// dark, and high-contrast themes without any user colour configuration. Tags
// are assigned a colour by their sorted position, cycling when there are more
// tags than palette entries.
const PALETTE = [
  'charts.yellow',
  'charts.red',
  'charts.orange',
  'charts.blue',
  'charts.green',
  'charts.purple',
]

/** Paints matching comment tags in the visible editors. */
export class TodoDecorator {
  private enabled: boolean
  private tags: string[]
  // One decoration type per tag, keyed by its upper-case name.
  private readonly types = new Map<string, TextEditorDecorationType>()

  constructor(config: Config) {
    this.enabled = config.highlightEnabled
    this.tags = config.tags
    this.build()
  }

  /** Re-read config, rebuild decoration types, and repaint. */
  setConfig(config: Config) {
    this.enabled = config.highlightEnabled
    this.tags = config.tags
    // Disposing types also clears their decorations from every editor.
    this.clearTypes()
    this.build()
    this.refresh()
  }

  /** Repaint every visible editor (split views included). */
  refresh() {
    for (const editor of window.visibleTextEditors) {
      this.apply(editor)
    }
  }

  dispose() {
    this.clearTypes()
  }

  private build() {
    if (!this.enabled) {
      return
    }
    const tags = [...new Set(this.tags.map(tag => tag.toUpperCase()))].sort()
    tags.forEach((tag, index) => {
      const color = new ThemeColor(PALETTE[index % PALETTE.length])
      this.types.set(tag, window.createTextEditorDecorationType({
        color,
        fontWeight: 'bold',
        overviewRulerColor: color,
        overviewRulerLane: OverviewRulerLane.Right,
        rangeBehavior: DecorationRangeBehavior.ClosedClosed,
      }))
    })
  }

  private clearTypes() {
    for (const type of this.types.values()) {
      type.dispose()
    }
    this.types.clear()
  }

  private apply(editor: TextEditor) {
    if (this.types.size === 0) {
      return
    }
    const byTag = new Map<string, Range[]>()
    for (const match of scanDocument(editor.document, this.tags)) {
      // Tags keep their length when upper-cased, so the tag word spans
      // [column, column + tag.length] on its line.
      const range = new Range(match.line, match.column, match.line, match.column + match.tag.length)
      const ranges = byTag.get(match.tag) ?? []
      ranges.push(range)
      byTag.set(match.tag, ranges)
    }
    // Set ranges for every type, so a tag that no longer matches has its
    // stale decorations cleared with an empty array.
    for (const [tag, type] of this.types) {
      editor.setDecorations(type, byTag.get(tag) ?? [])
    }
  }
}
