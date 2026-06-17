import type { TextEditor, TextEditorDecorationType } from 'vscode'
import type { Config, HighlightMode } from './config'
import { DecorationRangeBehavior, OverviewRulerLane, Range, window } from 'vscode'
import { buildTagColors } from './palette'
import { scanDocument } from './scanner'

/** Paints matching comment tags in the visible editors. */
export class TodoDecorator {
  private mode: HighlightMode
  private tags: string[]
  private tagColors: Map<string, string>
  // One decoration type per tag, keyed by its upper-case name.
  private readonly types = new Map<string, TextEditorDecorationType>()

  constructor(config: Config) {
    this.mode = config.highlight
    this.tags = config.tags
    this.tagColors = config.tagColors
    this.build()
  }

  /** Re-read config, rebuild decoration types, and repaint. */
  setConfig(config: Config) {
    this.mode = config.highlight
    this.tags = config.tags
    this.tagColors = config.tagColors
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
    if (this.mode === 'off') {
      return
    }
    for (const [tag, color] of buildTagColors(this.tags, this.tagColors)) {
      this.types.set(tag, window.createTextEditorDecorationType({
        color,
        fontWeight: 'bold',
        overviewRulerColor: color,
        overviewRulerLane: OverviewRulerLane.Right,
        rangeBehavior: DecorationRangeBehavior.ClosedClosed,
      }))
    }
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
      // [column, column + tag.length]; line mode runs to the content end.
      const end = this.mode === 'line'
        ? match.end
        : match.column + match.tag.length
      const range = new Range(match.line, match.column, match.line, end)
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
