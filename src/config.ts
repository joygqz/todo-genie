import { workspace } from 'vscode'

export type GroupBy = 'tag' | 'file'

export type HighlightMode = 'off' | 'tag' | 'line'

export interface Config {
  tags: string[]
  highlight: HighlightMode
  exclude: string[]
  /** Tag (upper-cased) to theme-colour-id overrides for the shared accent. */
  tagColors: Map<string, string>
  statusBar: boolean
}

const DEFAULT_TAGS = ['TODO', 'FIXME', 'HACK', 'BUG', 'XXX', 'NOTE']

export function getConfig(): Config {
  const config = workspace.getConfiguration('todo-genie')

  const tags = config.get<string[]>('tags', DEFAULT_TAGS)
    .map(tag => tag.trim())
    .filter(Boolean)

  const exclude = config.get<string[]>('exclude', [])
    .map(glob => glob.trim())
    .filter(Boolean)

  const tagColors = new Map<string, string>()
  for (const [tag, color] of Object.entries(config.get<Record<string, string>>('tagColors', {}))) {
    const id = color.trim()
    if (id) {
      tagColors.set(tag.trim().toUpperCase(), id)
    }
  }

  return {
    tags: tags.length ? tags : DEFAULT_TAGS,
    highlight: config.get<HighlightMode>('highlight', 'tag'),
    exclude,
    tagColors,
    statusBar: config.get<boolean>('statusBar', true),
  }
}
